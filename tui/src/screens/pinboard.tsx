import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Client, Project, Task, PinboardBoard, PinboardConnection } from '../api.js';

interface Props {
  client: Client;
  project: Project;
  onBack: () => void;
  onOpenTask: (task: Task) => void;
}

type Mode = 'list' | 'pin' | 'connect' | 'label' | 'conns';

function statusIcon(s: string): string {
  if (s === 'done') return '✔';
  if (s === 'in-progress') return '◐';
  return '○';
}
function priorityMark(p: string): string {
  if (p === 'high') return '!!';
  if (p === 'medium') return '!';
  return '';
}

export default function Pinboard({ client, project, onBack, onOpenTask }: Props) {
  const [board, setBoard] = useState<PinboardBoard | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [mode, setMode] = useState<Mode>('list');
  const [cursor, setCursor] = useState(0); // pinned-card cursor (list mode)
  const [subCursor, setSubCursor] = useState(0); // cursor inside pin/connect/conns modes
  const [sourceTaskId, setSourceTaskId] = useState<string | null>(null); // connect source
  const [activeConn, setActiveConn] = useState<PinboardConnection | null>(null); // label target
  const [labelDraft, setLabelDraft] = useState('');

  const load = useCallback(() => {
    Promise.all([client.getPinboard(project.id), client.listTasks(project.id)])
      .then(([b, ts]) => {
        setBoard(b);
        setTasks(ts);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load board'));
  }, [client, project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    tasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [tasks]);

  const titleOf = useCallback((id: string) => taskById.get(id)?.title ?? '(deleted task)', [taskById]);

  // Pinned cards whose task still exists.
  const cards = useMemo(
    () => (board ? board.cards.filter((c) => taskById.has(c.taskId)) : []),
    [board, taskById]
  );
  const pinnedIds = useMemo(() => new Set(cards.map((c) => c.taskId)), [cards]);
  const unpinned = useMemo(() => tasks.filter((t) => !pinnedIds.has(t.id)), [tasks, pinnedIds]);

  const connsOf = useCallback(
    (taskId: string) =>
      board ? board.connections.filter((c) => c.aTaskId === taskId || c.bTaskId === taskId) : [],
    [board]
  );
  const partnerOf = (c: PinboardConnection, taskId: string) =>
    c.aTaskId === taskId ? c.bTaskId : c.aTaskId;

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, cards.length - 1)));
  }, [cards.length]);

  const currentCard = cards[cursor];
  const connectTargets = useMemo(
    () => cards.filter((c) => c.taskId !== sourceTaskId),
    [cards, sourceTaskId]
  );
  const currentConns = currentCard ? connsOf(currentCard.taskId) : [];

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  useInput((input, key) => {
    if (busy || !board) return;
    if (mode === 'label') return; // TextInput owns the keyboard

    // --- pin picker ---
    if (mode === 'pin') {
      if (key.escape) { setMode('list'); return; }
      if (key.upArrow || input === 'k') { setSubCursor((c) => Math.max(0, c - 1)); return; }
      if (key.downArrow || input === 'j') { setSubCursor((c) => Math.min(unpinned.length - 1, c + 1)); return; }
      if (key.return) {
        const t = unpinned[subCursor];
        if (t) void run(() => client.pinCard(project.id, t.id, (cards.length % 6) * 30, 0));
      }
      return;
    }

    // --- connect target picker ---
    if (mode === 'connect') {
      if (key.escape) { setMode('list'); setSourceTaskId(null); return; }
      if (key.upArrow || input === 'k') { setSubCursor((c) => Math.max(0, c - 1)); return; }
      if (key.downArrow || input === 'j') { setSubCursor((c) => Math.min(connectTargets.length - 1, c + 1)); return; }
      if (key.return) {
        const target = connectTargets[subCursor];
        if (target && sourceTaskId) {
          void run(async () => {
            const conn = await client.connectPins(project.id, sourceTaskId, target.taskId);
            setActiveConn(conn);
            setLabelDraft('');
            setMode('label');
          });
        }
      }
      return;
    }

    // --- manage a card's connections ---
    if (mode === 'conns') {
      if (key.escape) { setMode('list'); return; }
      if (key.upArrow || input === 'k') { setSubCursor((c) => Math.max(0, c - 1)); return; }
      if (key.downArrow || input === 'j') { setSubCursor((c) => Math.min(currentConns.length - 1, c + 1)); return; }
      const conn = currentConns[subCursor];
      if (!conn) return;
      if (input === 'l') {
        setActiveConn(conn);
        setLabelDraft(conn.label);
        setMode('label');
        return;
      }
      if (input === 'x' || input === 'd') {
        void run(() => client.disconnectPin(conn.id));
        setSubCursor(0);
      }
      return;
    }

    // --- list mode ---
    if (input === 'q') process.exit(0);
    if (key.escape || input === 'b') { onBack(); return; }
    if (key.upArrow || input === 'k') { setCursor((c) => Math.max(0, c - 1)); return; }
    if (key.downArrow || input === 'j') { setCursor((c) => Math.min(cards.length - 1, c + 1)); return; }
    if (input === 'r') { load(); return; }
    if (input === 'p') { setSubCursor(0); setMode('pin'); return; }
    if (!currentCard) return;
    if (key.return) { const t = taskById.get(currentCard.taskId); if (t) onOpenTask(t); return; }
    if (input === 'u') { void run(() => client.unpinCard(currentCard.id)); return; }
    if (input === 'c') {
      if (cards.length < 2) return;
      setSourceTaskId(currentCard.taskId);
      setSubCursor(0);
      setMode('connect');
      return;
    }
    if (input === 'x') {
      if (currentConns.length === 0) return;
      setSubCursor(0);
      setMode('conns');
    }
  });

  const submitLabel = () => {
    const conn = activeConn;
    setMode(sourceTaskId ? 'list' : 'conns');
    setSourceTaskId(null);
    if (conn) void run(() => client.relabelPin(conn.id, labelDraft));
    setActiveConn(null);
  };

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>b: back · r: reload</Text>
      </Box>
    );
  }
  if (!board) {
    return (
      <Box padding={1}>
        <Text color="yellow">
          <Spinner type="dots" /> Loading board…
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor={project.color || 'cyan'} paddingX={1} flexDirection="column">
        <Box>
          <Text bold color={project.color || 'cyan'}>📌 {project.name} — Pinboard</Text>
          <Text dimColor> · {cards.length} pinned · {board.connections.length} string</Text>
        </Box>
        <Text dimColor>
          {mode === 'list' && 'j/k: move · enter: open · c: connect · x: strings · u: unpin · p: pin task · r: reload · b: back'}
          {mode === 'pin' && 'Pin a task — j/k: move · enter: pin · esc: done'}
          {mode === 'connect' && `Connect "${truncate(titleOf(sourceTaskId ?? ''), 28)}" to — j/k · enter: connect · esc: cancel`}
          {mode === 'label' && 'Type a label for the string · enter: save · (blank = no label)'}
          {mode === 'conns' && `Strings on "${truncate(currentCard ? titleOf(currentCard.taskId) : '', 28)}" — l: label · x: remove · esc: back`}
        </Text>
      </Box>

      {/* Label editor */}
      {mode === 'label' && (
        <Box borderStyle="round" borderColor="yellow" paddingX={1} marginTop={1}>
          <Text color="yellow">label </Text>
          <TextInput value={labelDraft} onChange={setLabelDraft} onSubmit={submitLabel} focus placeholder="e.g. blocks, related…" />
        </Box>
      )}

      {/* Pin picker */}
      {mode === 'pin' && (
        <Box borderStyle="round" borderColor="green" paddingX={1} marginTop={1} flexDirection="column">
          {unpinned.length === 0 && <Text dimColor>Every task is already pinned.</Text>}
          {unpinned.map((t, i) => (
            <Box key={t.id}>
              <Text color={i === subCursor ? 'green' : undefined}>{i === subCursor ? '▶ ' : '  '}</Text>
              <Text>{statusIcon(t.status)} {t.title}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Connect target picker */}
      {mode === 'connect' && (
        <Box borderStyle="round" borderColor="magenta" paddingX={1} marginTop={1} flexDirection="column">
          {connectTargets.map((c, i) => (
            <Box key={c.id}>
              <Text color={i === subCursor ? 'green' : undefined}>{i === subCursor ? '▶ ' : '  '}</Text>
              <Text>{titleOf(c.taskId)}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Connections manager */}
      {mode === 'conns' && currentCard && (
        <Box borderStyle="round" borderColor="magenta" paddingX={1} marginTop={1} flexDirection="column">
          {currentConns.length === 0 && <Text dimColor>No strings on this note.</Text>}
          {currentConns.map((c, i) => (
            <Box key={c.id}>
              <Text color={i === subCursor ? 'green' : undefined}>{i === subCursor ? '▶ ' : '  '}</Text>
              <Text>↔ {titleOf(partnerOf(c, currentCard.taskId))}</Text>
              {c.label ? <Text color="yellow"> [{c.label}]</Text> : <Text dimColor> (no label)</Text>}
            </Box>
          ))}
        </Box>
      )}

      {/* Main board list */}
      {mode === 'list' && (
        <Box borderStyle="round" borderColor="gray" paddingX={1} marginTop={1} flexDirection="column">
          {cards.length === 0 && <Text dimColor>Nothing pinned. Press p to pin a task.</Text>}
          {cards.map((card, i) => {
            const t = taskById.get(card.taskId);
            const selected = i === cursor;
            const conns = connsOf(card.taskId);
            const done = t?.status === 'done';
            return (
              <Box key={card.id} flexDirection="column">
                <Box>
                  <Text color={selected ? 'green' : undefined}>{selected ? '▶ ' : '  '}</Text>
                  <Text color={done ? 'gray' : undefined}>{statusIcon(t?.status ?? 'todo')} </Text>
                  {priorityMark(t?.priority ?? '') ? <Text color="red">{priorityMark(t?.priority ?? '')} </Text> : null}
                  <Text color={done ? 'gray' : undefined} strikethrough={done}>{t?.title ?? '(deleted task)'}</Text>
                  {conns.length > 0 && <Text dimColor> · {conns.length} string{conns.length === 1 ? '' : 's'}</Text>}
                </Box>
                {selected &&
                  conns.map((c) => (
                    <Box key={c.id} marginLeft={4}>
                      <Text dimColor>↔ {titleOf(partnerOf(c, card.taskId))}</Text>
                      {c.label ? <Text color="yellow"> [{c.label}]</Text> : null}
                    </Box>
                  ))}
              </Box>
            );
          })}
        </Box>
      )}

      {busy && (
        <Box marginTop={1} paddingX={1}>
          <Text color="yellow"><Spinner type="dots" /> working…</Text>
        </Box>
      )}
    </Box>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
