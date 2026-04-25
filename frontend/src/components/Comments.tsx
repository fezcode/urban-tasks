import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, Trash2, Pencil, X, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import * as api from '../api/client';
import type { Member } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Avatar from './Avatar';

interface Props {
  taskId: string;
  members: Member[];
}

// A mention is encoded in the body as @[Display Name](user-uuid).
const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-fA-F\-]{36})\)/g;

interface MentionPickerState {
  open: boolean;
  query: string;
  startPos: number; // position of the '@' in the textarea value
  cursor: number;  // current selectionStart (used to slice replacement region)
}

const Comments: React.FC<Props> = ({ taskId, members }) => {
  const { user } = useAuth();
  const { error: toastError } = useToast();
  const [items, setItems] = useState<api.TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const [picker, setPicker] = useState<MentionPickerState>({
    open: false,
    query: '',
    startPos: 0,
    cursor: 0,
  });
  const [pickerHighlight, setPickerHighlight] = useState(0);

  const refresh = async () => {
    try {
      const cs = await api.comments.list(taskId);
      setItems(cs ?? []);
    } catch (e) {
      toastError(api.friendlyErrorMessage(e, 'Failed to load comments'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const matches = useMemo(() => {
    if (!picker.open) return [];
    const q = picker.query.toLowerCase();
    return members
      .filter((m) =>
        q === '' ? true : m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [picker, members]);

  // Reset highlight whenever match list changes
  useEffect(() => {
    setPickerHighlight(0);
  }, [picker.query, picker.open]);

  const insertMention = (m: Member) => {
    const before = draft.slice(0, picker.startPos);
    const after = draft.slice(picker.cursor);
    const insertion = `@[${m.name || m.email}](${m.userId}) `;
    const next = before + insertion + after;
    setDraft(next);
    setPicker({ open: false, query: '', startPos: 0, cursor: 0 });
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        const pos = (before + insertion).length;
        el.focus();
        el.setSelectionRange(pos, pos);
      }
    });
  };

  const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setDraft(v);
    autosize(e.target);

    const cursor = e.target.selectionStart ?? v.length;
    // walk back from cursor to find the most recent unescaped '@' on this token
    let i = cursor - 1;
    let found = -1;
    while (i >= 0) {
      const ch = v[i];
      if (ch === '@') {
        found = i;
        break;
      }
      // mention tokens contain letters/digits/space/period/hyphen
      if (/\s/.test(ch) && i !== cursor - 1) break;
      if (cursor - i > 30) break; // safety
      i--;
    }
    if (found >= 0) {
      // Make sure '@' is at start-of-text or preceded by whitespace
      const prev = found > 0 ? v[found - 1] : ' ';
      if (/\s/.test(prev) || found === 0) {
        const query = v.slice(found + 1, cursor);
        if (!/[\[\]\(\)]/.test(query)) {
          setPicker({ open: true, query, startPos: found, cursor });
          return;
        }
      }
    }
    if (picker.open) setPicker({ open: false, query: '', startPos: 0, cursor: 0 });
  };

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const created = await api.comments.create(taskId, body);
      setItems((prev) => [...prev, created]);
      setDraft('');
    } catch (e) {
      toastError(api.friendlyErrorMessage(e, 'Failed to post comment'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await api.comments.delete(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      toastError(api.friendlyErrorMessage(e, 'Delete failed'));
    }
  };

  const handleStartEdit = (c: api.TaskComment) => {
    setEditingId(c.id);
    setEditDraft(c.body);
    requestAnimationFrame(() => {
      const el = editRef.current;
      if (el) {
        autosize(el);
        el.focus();
      }
    });
  };

  const handleSaveEdit = async (id: string) => {
    const body = editDraft.trim();
    if (!body) return;
    try {
      const updated = await api.comments.update(id, body);
      setItems((prev) => prev.map((c) => (c.id === id ? updated : c)));
      setEditingId(null);
      setEditDraft('');
    } catch (e) {
      toastError(api.friendlyErrorMessage(e, 'Save failed'));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={14} className="text-text-tertiary" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          Comments
        </span>
        <span className="text-2xs text-text-tertiary tabular-nums">{items.length}</span>
      </div>

      {loading ? (
        <p className="text-[13px] text-text-tertiary italic">Loading…</p>
      ) : (
        <div className="space-y-3 mb-4">
          {items.length === 0 && (
            <p className="text-[13px] text-text-tertiary italic">
              Be the first to comment. Type <code className="text-text-secondary">@</code> to mention a teammate.
            </p>
          )}
          {items.map((c) => {
            const isOwn = user?.id === c.userId;
            const editing = editingId === c.id;
            return (
              <div key={c.id} className="flex gap-2.5 group">
                <Avatar
                  seed={c.authorAvatarSeed ?? c.userId}
                  name={c.authorName ?? ''}
                  size={28}
                  className="rounded-full flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[13px] font-medium text-text-primary truncate">
                      {c.authorName || 'Unknown'}
                    </span>
                    <span className="text-2xs text-text-tertiary">
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                      {c.editedAt && <span className="ml-1 italic">(edited)</span>}
                    </span>
                    {isOwn && !editing && (
                      <div className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-base">
                        <button
                          onClick={() => handleStartEdit(c)}
                          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-base"
                          title="Edit"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => void handleDelete(c.id)}
                          className="p-1 rounded text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-base"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>

                  {editing ? (
                    <div>
                      <textarea
                        ref={editRef}
                        value={editDraft}
                        onChange={(e) => {
                          setEditDraft(e.target.value);
                          autosize(e.target);
                        }}
                        className="w-full bg-surface border border-border-focus rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none resize-none min-h-[60px]"
                      />
                      <div className="flex justify-end gap-1 mt-1">
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft('');
                          }}
                          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-secondary"
                          aria-label="Cancel"
                        >
                          <X size={14} />
                        </button>
                        <button
                          onClick={() => void handleSaveEdit(c.id)}
                          disabled={!editDraft.trim()}
                          className="p-1 rounded bg-accent text-text-inverse hover:bg-accent-hover disabled:opacity-50"
                          aria-label="Save"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <CommentBody body={c.body} currentUserId={user?.id} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleDraftChange}
          onKeyDown={(e) => {
            if (picker.open && matches.length > 0) {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPickerHighlight((h) => Math.min(matches.length - 1, h + 1));
                return;
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPickerHighlight((h) => Math.max(0, h - 1));
                return;
              }
              if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(matches[pickerHighlight]);
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setPicker({ open: false, query: '', startPos: 0, cursor: 0 });
                return;
              }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Write a comment… use @ to mention a teammate"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent resize-none min-h-[44px] leading-relaxed"
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-2xs text-text-tertiary">
            <kbd className="font-mono px-1 py-0.5 rounded bg-bg-secondary text-text-tertiary">⌘</kbd>+
            <kbd className="font-mono px-1 py-0.5 rounded bg-bg-secondary text-text-tertiary">↵</kbd> to send
          </span>
          <button
            onClick={() => void handleSend()}
            disabled={busy || !draft.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-text-inverse text-[12px] font-medium hover:bg-accent-hover transition-base disabled:opacity-50"
          >
            <Send size={12} />
            Comment
          </button>
        </div>

        {picker.open && matches.length > 0 && (
          <div className="absolute left-2 bottom-full mb-1 z-10 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-w-[300px]">
            {matches.map((m, i) => (
              <button
                key={m.userId}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
                onMouseEnter={() => setPickerHighlight(i)}
                className={`flex items-center gap-2 w-full text-left px-3 py-1.5 transition-base ${
                  i === pickerHighlight ? 'bg-bg-secondary' : ''
                }`}
              >
                <Avatar
                  seed={m.avatarSeed ?? m.userId}
                  name={m.name}
                  size={20}
                  className="rounded-full flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-text-primary truncate">{m.name || m.email}</div>
                  {m.name && (
                    <div className="text-2xs text-text-tertiary truncate">{m.email}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const CommentBody: React.FC<{ body: string; currentUserId?: string }> = ({ body, currentUserId }) => {
  // Render the body with mention tokens replaced by styled chips.
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  const re = new RegExp(MENTION_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<span key={key++}>{body.slice(lastIndex, m.index)}</span>);
    }
    const isMe = currentUserId && m[2].toLowerCase() === currentUserId.toLowerCase();
    parts.push(
      <span
        key={key++}
        className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium text-[12px] ${
          isMe
            ? 'bg-accent text-text-inverse'
            : 'bg-accent-light text-accent'
        }`}
      >
        @{m[1]}
      </span>
    );
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) {
    parts.push(<span key={key++}>{body.slice(lastIndex)}</span>);
  }
  return <p className="text-[13.5px] text-text-primary leading-relaxed whitespace-pre-wrap">{parts}</p>;
};

function autosize(el: HTMLTextAreaElement) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

export default Comments;
