import React, { useState } from 'react';
import {
  Check,
  RotateCcw,
  Trash2,
  Flag,
  FolderInput,
  X,
  ChevronDown,
} from 'lucide-react';
import { useAppState } from '../context/AppState';
import { useToast } from '../context/ToastContext';
import * as api from '../api/client';
import type { TaskPriority } from '../context/types';

interface Props {
  selectedIds: Set<string>;
  onClear: () => void;
}

type Menu = null | 'priority' | 'move';

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

const BulkActionBar: React.FC<Props> = ({ selectedIds, onClear }) => {
  const { state, reload } = useAppState();
  const { success, error: toastError } = useToast();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);

  const ids = Array.from(selectedIds);
  if (ids.length === 0) return null;

  const run = async (
    op: Parameters<typeof api.tasks.bulk>[1],
    payload?: Record<string, unknown>,
    label?: string
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.tasks.bulk(ids, op, payload);
      await reload();
      onClear();
      const failed = res.failed?.length ?? 0;
      if (failed > 0) {
        toastError(`${res.updated} updated, ${failed} failed`);
      } else {
        success(`${res.updated} ${label ?? 'updated'}`);
      }
    } catch (e) {
      toastError(api.friendlyErrorMessage(e, 'Bulk action failed'));
    } finally {
      setBusy(false);
      setMenu(null);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up">
      <div className="flex items-stretch gap-1 bg-text-primary text-text-inverse rounded-xl shadow-lg ring-1 ring-black/10 px-1.5 py-1.5">
        <div className="flex items-center px-3 text-[13px] font-medium">
          <span className="tabular-nums">{ids.length}</span>
          <span className="ml-1.5 opacity-70">selected</span>
        </div>

        <div className="w-px bg-white/15 my-1" />

        <button
          onClick={() => run('complete', undefined, 'completed')}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-base text-[13px]"
          title="Mark complete"
        >
          <Check size={14} />
          <span className="hidden sm:inline">Complete</span>
        </button>

        <button
          onClick={() => run('reopen', undefined, 'reopened')}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-base text-[13px]"
          title="Reopen"
        >
          <RotateCcw size={14} />
          <span className="hidden sm:inline">Reopen</span>
        </button>

        {/* Priority menu */}
        <div className="relative">
          <button
            onClick={() => setMenu(menu === 'priority' ? null : 'priority')}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-base text-[13px]"
            title="Set priority"
          >
            <Flag size={14} />
            <span className="hidden sm:inline">Priority</span>
            <ChevronDown size={12} className="opacity-60" />
          </button>
          {menu === 'priority' && (
            <div className="absolute bottom-full mb-1 left-0 min-w-[140px] bg-surface text-text-primary rounded-lg shadow-lg ring-1 ring-border py-1">
              {(['high', 'medium', 'low', 'none'] as TaskPriority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => run('set_priority', { priority: p }, `set to ${p}`)}
                  className="block w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-secondary transition-base"
                >
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Move-to menu */}
        <div className="relative">
          <button
            onClick={() => setMenu(menu === 'move' ? null : 'move')}
            disabled={busy || state.projects.length <= 1}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-base text-[13px] disabled:opacity-40"
            title="Move to project"
          >
            <FolderInput size={14} />
            <span className="hidden sm:inline">Move</span>
            <ChevronDown size={12} className="opacity-60" />
          </button>
          {menu === 'move' && (
            <div className="absolute bottom-full mb-1 left-0 min-w-[180px] max-h-[280px] overflow-y-auto bg-surface text-text-primary rounded-lg shadow-lg ring-1 ring-border py-1">
              {state.projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => run('move', { projectId: p.id }, `moved to ${p.name}`)}
                  className="flex items-center gap-2 w-full text-left px-3 py-1.5 text-[13px] hover:bg-bg-secondary transition-base"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="truncate">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => {
            if (window.confirm(`Delete ${ids.length} task${ids.length === 1 ? '' : 's'}?`)) {
              void run('delete', undefined, 'deleted');
            }
          }}
          disabled={busy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-500/30 text-red-300 hover:text-red-200 transition-base text-[13px]"
          title="Delete"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>

        <div className="w-px bg-white/15 my-1" />

        <button
          onClick={onClear}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition-base text-[13px] opacity-70 hover:opacity-100"
          title="Clear selection (Esc)"
          aria-label="Clear selection"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default BulkActionBar;
