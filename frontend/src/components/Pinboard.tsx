import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Menu, Pin as PinIcon, Plus, Search, X, ZoomIn, ZoomOut, Locate, Trash2 } from 'lucide-react';
import { useAppState } from '../context/AppState';
import { usePinboard } from '../hooks/usePinboard';
import type { Task } from '../context/types';
import {
  CARD_WIDTH,
  clampZoom,
  pinAnchor,
  screenToBoard,
  stringGeometry,
  type Point,
  type Viewport,
} from '../lib/board';

interface Props {
  onMenuClick: () => void;
  onSelectTask: (id: string | null) => void;
}

// Pushpin color by task priority — gives the board an at-a-glance triage read.
const PIN_COLORS: Record<string, string> = {
  high: '#d63a2f',
  medium: '#e0902a',
  low: '#3a7bd5',
  none: '#c0392b',
};

const STATUS_LABEL: Record<string, string> = {
  todo: 'To do',
  'in-progress': 'Active',
  done: 'Done',
};

// Deterministic small tilt (−3°..3°) per card so pinned notes look hand-placed.
function tiltFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 61) - 30) / 10;
}

type Drag =
  | { kind: 'pan'; downX: number; downY: number; panX0: number; panY0: number }
  | { kind: 'card'; cardId: string; grabDX: number; grabDY: number; downX: number; downY: number; moved: boolean }
  | { kind: 'connect'; fromTaskId: string; downX: number; downY: number; moved: boolean };

const MOVE_THRESHOLD = 5;

const Pinboard: React.FC<Props> = ({ onMenuClick, onSelectTask }) => {
  const { state } = useAppState();
  const projectId = state.activeProjectId;
  const project = useMemo(
    () => state.projects.find((p) => p.id === projectId) ?? null,
    [state.projects, projectId]
  );

  const board = usePinboard(projectId);
  const { cards, connections, pin, moveLocal, commitMove, unpin, connect, relabel, disconnect } = board;

  const taskMap = useMemo(() => {
    const m = new Map<string, Task>();
    state.tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [state.tasks]);

  const cardByTask = useMemo(() => {
    const m = new Map<string, (typeof cards)[number]>();
    cards.forEach((c) => m.set(c.taskId, c));
    return m;
  }, [cards]);

  const pinnedTaskIds = useMemo(() => new Set(cards.map((c) => c.taskId)), [cards]);

  // Cards whose underlying task still exists (a task deleted elsewhere drops out).
  const liveCards = useMemo(() => cards.filter((c) => taskMap.has(c.taskId)), [cards, taskMap]);

  const [vp, setVp] = useState<Viewport>({ panX: 0, panY: 0, zoom: 1 });
  const vpRef = useRef(vp);
  vpRef.current = vp;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  // Live-connect state (drag from a pushpin, or "armed" tap-to-connect on touch).
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const connectFromRef = useRef<string | null>(null);
  connectFromRef.current = connectFrom;
  const [connectCursor, setConnectCursor] = useState<Point | null>(null);

  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [editingConnId, setEditingConnId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Multi-touch pinch tracking.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number; vp: Viewport } | null>(null);

  // --- Auto-center on the pinned notes the first time a project's board opens ---
  const centeredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!projectId || board.loading) return;
    if (centeredRef.current === projectId) return;
    centeredRef.current = projectId;
    const el = boardRef.current;
    if (!el || liveCards.length === 0) {
      setVp({ panX: 0, panY: 0, zoom: 1 });
      return;
    }
    let sx = 0;
    let sy = 0;
    liveCards.forEach((c) => {
      sx += c.x + CARD_WIDTH / 2;
      sy += c.y + 70;
    });
    const cx = sx / liveCards.length;
    const cy = sy / liveCards.length;
    const rect = el.getBoundingClientRect();
    setVp({ panX: rect.width / 2 - cx, panY: rect.height / 2 - cy, zoom: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, board.loading, liveCards]);

  // --- Escape cancels armed-connect / selection / editing ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setConnectFrom(null);
      setConnectCursor(null);
      setSelectedConnId(null);
      setEditingConnId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // --- Zoom helpers ---
  const zoomAround = useCallback((factor: number, cx: number, cy: number) => {
    setVp((v) => {
      const zoom = clampZoom(v.zoom * factor);
      const scale = zoom / v.zoom;
      return {
        zoom,
        panX: cx - (cx - v.panX) * scale,
        panY: cy - (cy - v.panY) * scale,
      };
    });
  }, []);

  const zoomButton = useCallback(
    (factor: number) => {
      const el = boardRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      zoomAround(factor, rect.width / 2, rect.height / 2);
    },
    [zoomAround]
  );

  const resetView = useCallback(() => {
    centeredRef.current = null; // re-trigger auto-center
    setVp({ panX: 0, panY: 0, zoom: 1 });
    setConnectFrom(null);
    setSelectedConnId(null);
  }, []);

  // Native wheel listener (passive:false so we can preventDefault the page scroll).
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAround(factor, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAround]);

  // Board-space point at the center of the current viewport (for placing new pins).
  const viewportCenterBoard = useCallback((): Point => {
    const el = boardRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return screenToBoard(rect.left + rect.width / 2, rect.top + rect.height / 2, rect, vpRef.current);
  }, []);

  const handlePin = useCallback(
    (taskId: string) => {
      const center = viewportCenterBoard();
      const n = cardsRef.current.length;
      const offset = (n % 6) * 26;
      void pin(taskId, center.x - CARD_WIDTH / 2 + offset, center.y - 60 + offset);
    },
    [pin, viewportCenterBoard]
  );

  // --- Pointer interaction (pan / move card / connect / pinch) ---
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const el = boardRef.current;
      if (!el) return;
      const target = e.target as HTMLElement;
      // Buttons, string labels, and the picker manage their own pointer handling.
      if (target.closest('[data-stop]')) return;

      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // Second finger down → enter pinch, abandoning any single-pointer drag.
      if (pointersRef.current.size === 2) {
        const pts = Array.from(pointersRef.current.values());
        const dx = pts[0].x - pts[1].x;
        const dy = pts[0].y - pts[1].y;
        const rect = el.getBoundingClientRect();
        pinchRef.current = {
          dist: Math.hypot(dx, dy),
          cx: (pts[0].x + pts[1].x) / 2 - rect.left,
          cy: (pts[0].y + pts[1].y) / 2 - rect.top,
          vp: vpRef.current,
        };
        dragRef.current = null;
        return;
      }
      if (pointersRef.current.size > 2) return;

      const cardEl = target.closest('[data-card-id]') as HTMLElement | null;

      // Armed tap-to-connect: a prior pin tap left us waiting for a target.
      if (connectFromRef.current) {
        if (cardEl) {
          const taskId = cardEl.dataset.cardTask!;
          if (taskId !== connectFromRef.current) void connect(connectFromRef.current, taskId);
        }
        setConnectFrom(null);
        setConnectCursor(null);
        return;
      }

      setSelectedConnId(null);
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture is best-effort */
      }
      const rect = el.getBoundingClientRect();
      const bp = screenToBoard(e.clientX, e.clientY, rect, vpRef.current);

      if (cardEl) {
        const cardId = cardEl.dataset.cardId!;
        const taskId = cardEl.dataset.cardTask!;
        if (target.closest('[data-pin]')) {
          dragRef.current = { kind: 'connect', fromTaskId: taskId, downX: e.clientX, downY: e.clientY, moved: false };
          setConnectFrom(taskId);
          setConnectCursor(bp);
        } else {
          const card = cardsRef.current.find((c) => c.id === cardId);
          if (!card) return;
          dragRef.current = {
            kind: 'card',
            cardId,
            grabDX: bp.x - card.x,
            grabDY: bp.y - card.y,
            downX: e.clientX,
            downY: e.clientY,
            moved: false,
          };
        }
      } else {
        dragRef.current = { kind: 'pan', downX: e.clientX, downY: e.clientY, panX0: vpRef.current.panX, panY0: vpRef.current.panY };
      }
    },
    [connect]
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = boardRef.current;
    if (!el) return;

    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch zoom takes priority while two fingers are down.
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const start = pinchRef.current;
      const zoom = clampZoom(start.vp.zoom * (dist / start.dist));
      const scale = zoom / start.vp.zoom;
      setVp({
        zoom,
        panX: start.cx - (start.cx - start.vp.panX) * scale,
        panY: start.cy - (start.cy - start.vp.panY) * scale,
      });
      return;
    }

    const d = dragRef.current;
    if (!d) return;
    const rect = el.getBoundingClientRect();

    if (d.kind === 'pan') {
      setVp((v) => ({ ...v, panX: d.panX0 + (e.clientX - d.downX), panY: d.panY0 + (e.clientY - d.downY) }));
      return;
    }

    const movedEnough = Math.hypot(e.clientX - d.downX, e.clientY - d.downY) > MOVE_THRESHOLD;
    const bp = screenToBoard(e.clientX, e.clientY, rect, vpRef.current);

    if (d.kind === 'card') {
      if (movedEnough) d.moved = true;
      moveLocal(d.cardId, bp.x - d.grabDX, bp.y - d.grabDY);
    } else if (d.kind === 'connect') {
      if (movedEnough) d.moved = true;
      setConnectCursor(bp);
    }
  }, [moveLocal]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      if (pointersRef.current.size < 2) pinchRef.current = null;

      const el = boardRef.current;
      try {
        el?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const d = dragRef.current;
      dragRef.current = null;
      if (!d) return;

      if (d.kind === 'card') {
        const card = cardsRef.current.find((c) => c.id === d.cardId);
        if (!card) return;
        if (d.moved) {
          void commitMove(d.cardId, card.x, card.y);
        } else {
          onSelectTask(card.taskId);
        }
      } else if (d.kind === 'connect') {
        if (d.moved) {
          const overEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-card-id]') as HTMLElement | null;
          const targetTask = overEl?.dataset.cardTask;
          if (targetTask && targetTask !== d.fromTaskId) void connect(d.fromTaskId, targetTask);
          setConnectFrom(null);
          setConnectCursor(null);
        } else {
          // A tap on the pin "arms" the card: next card tap completes the string.
          setConnectFrom(d.fromTaskId);
          setConnectCursor(null);
        }
      }
    },
    [commitMove, connect, onSelectTask]
  );

  // Live string being dragged / armed from a pin.
  const liveFromCard = connectFrom ? cardByTask.get(connectFrom) : null;
  const liveFrom = liveFromCard ? pinAnchor(liveFromCard) : null;

  // --- Empty state: pinboard is per-project ---
  if (!projectId) {
    return (
      <div className="flex-1 flex flex-col">
        <Toolbar
          title="Pinboard"
          subtitle={null}
          onMenuClick={onMenuClick}
          onPinClick={() => {}}
          onZoomIn={() => {}}
          onZoomOut={() => {}}
          onReset={() => {}}
          disabled
        />
        <div className="flex-1 grid place-items-center p-8" style={corkStyle}>
          <div className="text-center max-w-xs rounded-2xl bg-black/30 px-6 py-5 backdrop-blur-[1px]">
            <PinIcon size={28} className="mx-auto mb-3 text-white/80" />
            <p className="text-[15px] font-semibold text-white">Pick a project</p>
            <p className="text-[13px] text-white/70 mt-1">
              Each project has its own corkboard. Select one from the sidebar to start pinning.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Toolbar
        title={project ? project.name : 'Pinboard'}
        subtitle={`${liveCards.length} pinned · ${connections.length} string`}
        onMenuClick={onMenuClick}
        onPinClick={() => setPickerOpen(true)}
        onZoomIn={() => zoomButton(1.2)}
        onZoomOut={() => zoomButton(1 / 1.2)}
        onReset={resetView}
        accent={project?.color}
      />

      <div
        ref={boardRef}
        className="relative flex-1 overflow-hidden touch-none select-none"
        style={{ ...corkStyle, cursor: dragRef.current?.kind === 'pan' ? 'grabbing' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Wooden frame + inner shadow vignette */}
        <div className="pointer-events-none absolute inset-0 z-30" style={frameStyle} />

        {/* Transformed board layer (cards + string live in board space) */}
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${vp.panX}px, ${vp.panY}px) scale(${vp.zoom})` }}
        >
          {/* String layer — drawn in board coordinates, overflow visible */}
          <svg width={1} height={1} style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}>
            <defs>
              <filter id="string-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.35" />
              </filter>
            </defs>
            {connections.map((c) => {
              const a = cardByTask.get(c.aTaskId);
              const b = cardByTask.get(c.bTaskId);
              if (!a || !b || !taskMap.has(c.aTaskId) || !taskMap.has(c.bTaskId)) return null;
              const { path } = stringGeometry(pinAnchor(a), pinAnchor(b));
              const selected = selectedConnId === c.id;
              return (
                <g key={c.id}>
                  {/* Fat invisible hit area */}
                  <path
                    d={path}
                    stroke="transparent"
                    strokeWidth={18}
                    fill="none"
                    style={{ cursor: 'pointer' }}
                    data-stop
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedConnId((id) => (id === c.id ? null : c.id));
                    }}
                  />
                  <path
                    d={path}
                    stroke={selected ? '#e74c3c' : '#b3382c'}
                    strokeWidth={selected ? 4 : 3}
                    strokeLinecap="round"
                    fill="none"
                    filter="url(#string-shadow)"
                    pointerEvents="none"
                  />
                </g>
              );
            })}
            {/* Live connecting string */}
            {liveFrom && connectCursor && (
              <path
                d={stringGeometry(liveFrom, connectCursor).path}
                stroke="#e74c3c"
                strokeWidth={2.5}
                strokeDasharray="6 6"
                strokeLinecap="round"
                fill="none"
                pointerEvents="none"
              />
            )}
          </svg>

          {/* String labels (tape) — separate layer so they sit above the yarn */}
          {connections.map((c) => {
            const a = cardByTask.get(c.aTaskId);
            const b = cardByTask.get(c.bTaskId);
            if (!a || !b || !taskMap.has(c.aTaskId) || !taskMap.has(c.bTaskId)) return null;
            const { mid } = stringGeometry(pinAnchor(a), pinAnchor(b));
            const selected = selectedConnId === c.id;
            if (editingConnId === c.id) {
              return (
                <LabelEditor
                  key={c.id}
                  mid={mid}
                  initial={c.label}
                  onCommit={(text) => {
                    void relabel(c.id, text);
                    setEditingConnId(null);
                  }}
                  onCancel={() => setEditingConnId(null)}
                />
              );
            }
            if (!c.label && !selected) return null;
            return (
              <div
                key={c.id}
                data-stop
                className="absolute"
                style={{ left: mid.x, top: mid.y, transform: 'translate(-50%, -50%)' }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingConnId(c.id)}
                    className="px-2 py-0.5 rounded-[3px] text-[11px] font-medium text-stone-800 shadow-sm"
                    style={tapeStyle}
                    title="Edit label"
                  >
                    {c.label || 'label…'}
                  </button>
                  {selected && (
                    <button
                      onClick={() => {
                        void disconnect(c.id);
                        setSelectedConnId(null);
                      }}
                      className="grid place-items-center w-5 h-5 rounded-full bg-red-600 text-white shadow"
                      title="Remove string"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Note cards */}
          {liveCards.map((card) => {
            const task = taskMap.get(card.taskId)!;
            return (
              <NoteCard
                key={card.id}
                cardId={card.id}
                task={task}
                x={card.x}
                y={card.y}
                armed={connectFrom === task.id}
                onUnpin={() => void unpin(card.id)}
              />
            );
          })}
        </div>

        {/* Hint when armed for tap-to-connect */}
        {connectFrom && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-full bg-black/70 text-white text-[12px] shadow-lg">
            Tap another note to connect · Esc to cancel
          </div>
        )}

        {/* Empty board hint */}
        {!board.loading && liveCards.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center z-20 p-8">
            <div className="text-center max-w-xs rounded-2xl bg-black/30 px-6 py-5">
              <PinIcon size={26} className="mx-auto mb-3 text-white/80" />
              <p className="text-[15px] font-semibold text-white">Nothing pinned yet</p>
              <p className="text-[13px] text-white/70 mt-1">
                Pin tasks to lay out your investigation, then drag string between them.
              </p>
            </div>
          </div>
        )}
      </div>

      {pickerOpen && (
        <PinPicker
          tasks={state.tasks.filter((t) => t.projectId === projectId && !pinnedTaskIds.has(t.id))}
          onPin={handlePin}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
};

// --- Toolbar ---

interface ToolbarProps {
  title: string;
  subtitle: string | null;
  onMenuClick: () => void;
  onPinClick: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  accent?: string;
  disabled?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = ({
  title,
  subtitle,
  onMenuClick,
  onPinClick,
  onZoomIn,
  onZoomOut,
  onReset,
  accent,
  disabled,
}) => (
  <header className="flex-shrink-0 flex items-center gap-2 px-3 sm:px-5 py-3 border-b border-border bg-surface">
    <button
      onClick={onMenuClick}
      className="p-2 -ml-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-base"
      title="Toggle sidebar"
    >
      <Menu size={20} />
    </button>
    {accent && <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />}
    <div className="min-w-0">
      <h1 className="text-[15px] font-semibold text-text-primary truncate leading-tight">{title}</h1>
      {subtitle && <p className="text-2xs text-text-tertiary truncate">{subtitle}</p>}
    </div>

    <div className="ml-auto flex items-center gap-1.5">
      <div className="flex items-center rounded-lg bg-bg-secondary">
        <button onClick={onZoomOut} disabled={disabled} className="p-1.5 rounded-l-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-base disabled:opacity-40" title="Zoom out">
          <ZoomOut size={16} />
        </button>
        <button onClick={onReset} disabled={disabled} className="p-1.5 text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-base disabled:opacity-40" title="Reset view">
          <Locate size={16} />
        </button>
        <button onClick={onZoomIn} disabled={disabled} className="p-1.5 rounded-r-lg text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-base disabled:opacity-40" title="Zoom in">
          <ZoomIn size={16} />
        </button>
      </div>
      <button
        onClick={onPinClick}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2 bg-accent text-text-inverse rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-base disabled:opacity-40"
      >
        <Plus size={15} />
        <span className="hidden sm:inline">Pin tasks</span>
      </button>
    </div>
  </header>
);

// --- Note card ---

interface NoteCardProps {
  cardId: string;
  task: Task;
  x: number;
  y: number;
  armed: boolean;
  onUnpin: () => void;
}

const NoteCard: React.FC<NoteCardProps> = React.memo(({ cardId, task, x, y, armed, onUnpin }) => {
  const tilt = tiltFor(cardId);
  const pinColor = PIN_COLORS[task.priority ?? 'none'] ?? PIN_COLORS.none;
  const done = task.status === 'done';

  return (
    <div
      data-card-id={cardId}
      data-card-task={task.id}
      className="absolute group"
      style={{
        left: x,
        top: y,
        width: CARD_WIDTH,
        transform: `rotate(${tilt}deg)`,
        cursor: 'grab',
      }}
    >
      {/* String/connect handle: the pushpin (top-center) */}
      <div
        data-pin
        className="absolute left-1/2 -top-2 -translate-x-1/2 z-10"
        style={{ cursor: 'crosshair' }}
        title="Drag to another note to connect"
      >
        <Pushpin color={pinColor} active={armed} />
      </div>

      {/* Paper */}
      <div
        className="rounded-[3px] px-3 pt-4 pb-2.5"
        style={{
          ...paperStyle,
          outline: armed ? '2px solid #e74c3c' : 'none',
          outlineOffset: 2,
          opacity: done ? 0.82 : 1,
        }}
      >
        <button
          data-stop
          onClick={(e) => {
            e.stopPropagation();
            onUnpin();
          }}
          className="absolute top-1 right-1 grid place-items-center w-5 h-5 rounded-full text-stone-500 opacity-0 group-hover:opacity-100 hover:bg-black/10 hover:text-stone-800 transition-base"
          title="Unpin"
        >
          <X size={13} />
        </button>

        <div
          className="text-[13px] font-semibold leading-snug text-stone-900 break-words"
          style={{ fontFamily: "'Courier New', ui-monospace, monospace", textDecoration: done ? 'line-through' : 'none' }}
        >
          {task.title}
        </div>

        {/* Red index-card rule */}
        <div className="my-1.5 h-px" style={{ background: 'rgba(192,57,43,0.45)' }} />

        <div className="flex items-center gap-1 flex-wrap">
          <span className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium text-stone-600 bg-black/[0.06]">
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
          {task.priority && task.priority !== 'none' && (
            <span className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium text-white capitalize" style={{ backgroundColor: pinColor }}>
              {task.priority}
            </span>
          )}
          {task.dueDate && (
            <span className="px-1.5 py-0.5 rounded-[2px] text-[10px] font-medium text-stone-600 bg-black/[0.06]">
              {task.dueDate.slice(5)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
NoteCard.displayName = 'NoteCard';

const Pushpin: React.FC<{ color: string; active: boolean }> = ({ color, active }) => (
  <div className="relative" style={{ width: 18, height: 18, filter: 'drop-shadow(0 2px 1.5px rgba(0,0,0,0.4))' }}>
    <div
      className="absolute inset-0 rounded-full"
      style={{
        background: `radial-gradient(circle at 32% 28%, #ffffff 0%, ${color} 42%, ${color} 70%, rgba(0,0,0,0.45) 100%)`,
        border: active ? '2px solid #fff' : 'none',
      }}
    />
    {/* glossy highlight */}
    <div className="absolute rounded-full bg-white/70" style={{ width: 5, height: 5, left: 4, top: 3 }} />
  </div>
);

// --- String label inline editor ---

const LabelEditor: React.FC<{
  mid: Point;
  initial: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}> = ({ mid, initial, onCommit, onCancel }) => {
  const [text, setText] = useState(initial);
  return (
    <div
      data-stop
      className="absolute z-20"
      style={{ left: mid.x, top: mid.y, transform: 'translate(-50%, -50%)' }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        autoFocus
        value={text}
        maxLength={80}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit(text);
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="label…"
        className="px-2 py-0.5 rounded-[3px] text-[11px] text-stone-900 shadow outline-none"
        style={{ ...tapeStyle, width: 110 }}
      />
    </div>
  );
};

// --- Pin-tasks picker ---

const PinPicker: React.FC<{
  tasks: Task[];
  onPin: (taskId: string) => void;
  onClose: () => void;
}> = ({ tasks, onPin, onClose }) => {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const base = needle ? tasks.filter((t) => t.title.toLowerCase().includes(needle)) : tasks;
    return base.slice(0, 200);
  }, [tasks, q]);

  return (
    <div
      className="absolute inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-lg my-8 animate-slide-down">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <PinIcon size={18} className="text-accent" />
            <h2 className="text-[15px] font-semibold text-text-primary">Pin tasks</h2>
            <span className="text-2xs text-text-tertiary tabular-nums">{tasks.length}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-base" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-secondary">
            <Search size={15} className="text-text-tertiary" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tasks…"
              className="flex-1 bg-transparent text-[14px] text-text-primary outline-none"
            />
          </div>
        </div>

        <div className="px-3 py-3 max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-[13px] text-text-tertiary py-8">
              {tasks.length === 0 ? 'Every task is already on the board.' : 'No matching tasks.'}
            </p>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onPin(t.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-secondary transition-base text-left"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: PIN_COLORS[t.priority ?? 'none'] ?? PIN_COLORS.none }}
                  />
                  <span className="flex-1 min-w-0 text-[13.5px] text-text-primary truncate">{t.title}</span>
                  <Plus size={15} className="text-text-tertiary flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Skeuomorphic surfaces ---

const corkStyle: React.CSSProperties = {
  backgroundColor: '#c39a5c',
  backgroundImage:
    'radial-gradient(circle at 18% 22%, rgba(80,50,20,0.16) 0 1.5px, transparent 2.5px),' +
    'radial-gradient(circle at 62% 44%, rgba(70,45,18,0.13) 0 1.5px, transparent 2.5px),' +
    'radial-gradient(circle at 38% 78%, rgba(255,240,210,0.10) 0 1.5px, transparent 2.5px),' +
    'radial-gradient(circle at 82% 64%, rgba(60,38,14,0.12) 0 1px, transparent 2px),' +
    'radial-gradient(circle at 8% 88%, rgba(255,240,210,0.08) 0 1px, transparent 2px),' +
    'radial-gradient(circle at 50% 50%, rgba(150,110,60,0.25), rgba(120,84,40,0.35))',
  backgroundSize: '46px 46px, 58px 58px, 52px 52px, 38px 38px, 64px 64px, 100% 100%',
};

const frameStyle: React.CSSProperties = {
  border: '14px solid #5c3d22',
  borderImage: 'linear-gradient(135deg, #8a5e36, #5c3d22 45%, #7a5230 55%, #4f3219) 1',
  boxShadow: 'inset 0 0 40px rgba(40,22,8,0.55), inset 0 0 4px rgba(0,0,0,0.6)',
};

const paperStyle: React.CSSProperties = {
  position: 'relative',
  background: 'linear-gradient(150deg, #fffdf4 0%, #f7f0dd 100%)',
  boxShadow: '0 6px 12px rgba(0,0,0,0.32), 0 1px 2px rgba(0,0,0,0.25)',
  border: '1px solid rgba(120,100,60,0.25)',
};

const tapeStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, #fff8e6, #f3e6c4)',
  border: '1px solid rgba(120,100,60,0.35)',
  transform: 'rotate(-1.5deg)',
};

export default Pinboard;
