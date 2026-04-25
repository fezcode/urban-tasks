import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Pencil, Filter as FilterIcon, Check } from 'lucide-react';
import * as api from '../api/client';
import { useAppState } from '../context/AppState';
import { useToast } from '../context/ToastContext';

interface Props {
  items: api.SavedFilter[];
  onClose: () => void;
  onChanged: () => void;
}

const DUE_RANGE_LABEL: Record<string, string> = {
  today: 'Due today',
  upcoming: 'Next 7 days',
  archive: 'Archive (done)',
};

const SavedFiltersModal: React.FC<Props> = ({ items, onClose, onChanged }) => {
  const { state } = useAppState();
  const { error: toastError, success } = useToast();
  const [editingId, setEditingId] = useState<string | 'new' | null>(items.length === 0 ? 'new' : null);
  const [busy, setBusy] = useState(false);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    state.tasks.forEach((t) => t.tags?.forEach((tg) => set.add(tg)));
    return Array.from(set).sort();
  }, [state.tasks]);

  const summarize = (def: api.SavedFilterDef): string => {
    const bits: string[] = [];
    if (def.projectId) {
      const p = state.projects.find((x) => x.id === def.projectId);
      bits.push(p ? p.name : 'project');
    }
    if (def.tag) bits.push(`@${def.tag}`);
    if (def.dueRange) bits.push(DUE_RANGE_LABEL[def.dueRange] ?? def.dueRange);
    if (def.status && def.status !== 'all') bits.push(def.status);
    if (def.priority && def.priority !== 'all') bits.push(`${def.priority} priority`);
    return bits.length === 0 ? 'All tasks' : bits.join(' · ');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this saved filter?')) return;
    setBusy(true);
    try {
      await api.savedFilters.delete(id);
      success('Saved filter deleted');
      onChanged();
    } catch (e) {
      toastError(api.friendlyErrorMessage(e, 'Delete failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-surface border border-border rounded-2xl shadow-lg my-8 animate-slide-down">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <FilterIcon size={18} className="text-accent" />
            <h2 className="text-[15px] font-semibold text-text-primary">Smart lists</h2>
            <span className="text-2xs text-text-tertiary tabular-nums">{items.length}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-base"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto">
          {/* Existing filters */}
          {items.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {items.map((f) => (
                <div
                  key={f.id}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-secondary transition-base"
                >
                  <FilterIcon size={14} className="text-text-tertiary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-text-primary truncate">{f.name}</div>
                    <div className="text-2xs text-text-tertiary truncate">{summarize(f.filter)}</div>
                  </div>
                  <button
                    onClick={() => setEditingId(f.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface transition-base"
                    title="Edit"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => void handleDelete(f.id)}
                    disabled={busy}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-base"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Editor */}
          {editingId !== null ? (
            <SavedFilterEditor
              key={editingId}
              initial={editingId === 'new' ? null : items.find((f) => f.id === editingId) ?? null}
              projects={state.projects}
              allTags={allTags}
              busy={busy}
              setBusy={setBusy}
              onCancel={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                onChanged();
              }}
            />
          ) : (
            <button
              onClick={() => setEditingId('new')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed border-border text-[13px] text-text-secondary hover:border-accent hover:text-accent transition-base"
            >
              <Plus size={14} />
              New smart list
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface EditorProps {
  initial: api.SavedFilter | null;
  projects: { id: string; name: string; color: string }[];
  allTags: string[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
}

const SavedFilterEditor: React.FC<EditorProps> = ({
  initial,
  projects,
  allTags,
  busy,
  setBusy,
  onCancel,
  onSaved,
}) => {
  const { error: toastError, success } = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const def = initial?.filter ?? {};
  const [projectId, setProjectId] = useState<string | null>(def.projectId ?? null);
  const [tag, setTag] = useState<string | null>(def.tag ?? null);
  const [dueRange, setDueRange] = useState<api.SavedFilterDef['dueRange']>(def.dueRange ?? null);
  const [status, setStatus] = useState<api.SavedFilterDef['status']>(def.status ?? 'all');
  const [priority, setPriority] = useState<api.SavedFilterDef['priority']>(def.priority ?? 'all');

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toastError('Name is required');
      return;
    }
    const filter: api.SavedFilterDef = {
      projectId,
      tag,
      dueRange,
      status,
      priority,
    };
    setBusy(true);
    try {
      if (initial) {
        await api.savedFilters.update(initial.id, { name: trimmed, filter });
        success('Saved filter updated');
      } else {
        await api.savedFilters.create({ name: trimmed, filter });
        success('Saved filter created');
      }
      onSaved();
    } catch (e) {
      toastError(api.friendlyErrorMessage(e, 'Save failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-border rounded-xl p-4 bg-bg-secondary/40 space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-text-tertiary font-semibold">
        {initial ? 'Edit smart list' : 'New smart list'}
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. My high-priority due this week"
        autoFocus
        className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-[14px] text-text-primary outline-none focus:border-accent transition-base"
      />

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Project">
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(e.target.value || null)}
            className="select-input"
          >
            <option value="">Any project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tag">
          <select
            value={tag ?? ''}
            onChange={(e) => setTag(e.target.value || null)}
            className="select-input"
          >
            <option value="">Any tag</option>
            {allTags.map((t) => (
              <option key={t} value={t}>
                @{t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due">
          <select
            value={dueRange ?? ''}
            onChange={(e) =>
              setDueRange((e.target.value || null) as api.SavedFilterDef['dueRange'])
            }
            className="select-input"
          >
            <option value="">Any time</option>
            <option value="today">Due today</option>
            <option value="upcoming">Next 7 days</option>
            <option value="archive">Archive (done)</option>
          </select>
        </Field>
        <Field label="Status">
          <select
            value={status ?? 'all'}
            onChange={(e) => setStatus(e.target.value as api.SavedFilterDef['status'])}
            className="select-input"
          >
            <option value="all">All</option>
            <option value="todo">To do</option>
            <option value="in-progress">In progress</option>
            <option value="done">Done</option>
          </select>
        </Field>
        <Field label="Priority">
          <select
            value={priority ?? 'all'}
            onChange={(e) => setPriority(e.target.value as api.SavedFilterDef['priority'])}
            className="select-input"
          >
            <option value="all">Any</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-[13px] text-text-secondary hover:bg-bg-secondary transition-base"
        >
          Cancel
        </button>
        <button
          onClick={() => void submit()}
          disabled={busy || !name.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-text-inverse text-[13px] font-medium hover:bg-accent-hover transition-base disabled:opacity-50"
        >
          <Check size={14} />
          {initial ? 'Save changes' : 'Create'}
        </button>
      </div>

      <style>{`
        .select-input {
          width: 100%;
          padding: 6px 10px;
          border-radius: 6px;
          background: var(--surface, white);
          border: 1px solid var(--border, #e5e5e5);
          color: var(--text-primary, #111);
          font-size: 13px;
          outline: none;
        }
        .select-input:focus {
          border-color: var(--accent, #C96442);
        }
      `}</style>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <div className="text-2xs font-medium text-text-tertiary uppercase tracking-wider mb-1">
      {label}
    </div>
    {children}
  </label>
);

export default SavedFiltersModal;
