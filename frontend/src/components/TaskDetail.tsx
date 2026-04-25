import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppState';
import type { TaskStatus, TaskPriority, TaskRecurrence } from '../context/types';
import ReactMarkdown from 'react-markdown';
import {
  X,
  Trash2,
  Calendar,
  Tag,
  Check,
  Play,
  RotateCcw,
  Pencil,
  CalendarClock,
  Flag,
  Link2,
  Plus,
  Link as LinkIcon,
  ListChecks,
  Square,
  CheckSquare,
  RefreshCw,
  Share2,
  UserCircle2,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { format, differenceInDays, startOfDay } from 'date-fns';
import ProjectIcon from './ProjectIcon';
import DatePicker from './DatePicker';
import Avatar from './Avatar';
import * as api from '../api/client';
import type { Member } from '../api/client';
import Comments from './Comments';

interface Props {
  taskId: string;
  onClose: () => void;
  onTagClick?: (tag: string) => void;
}

function getDueDateLabel(dueDate: string): { label: string; className: string } {
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate));
  const diff = differenceInDays(due, today);

  if (diff < 0)
    return {
      label: `${Math.abs(diff)} day${Math.abs(diff) !== 1 ? 's' : ''} overdue`,
      className: 'text-danger',
    };
  if (diff === 0) return { label: 'Due today', className: 'text-status-warning' };
  if (diff === 1) return { label: 'Due tomorrow', className: 'text-text-secondary' };
  if (diff <= 7) return { label: `Due in ${diff} days`, className: 'text-text-secondary' };
  return { label: `Due ${format(due, 'MMM d, yyyy')}`, className: 'text-text-tertiary' };
}

const TaskDetail: React.FC<Props> = ({ taskId, onClose, onTagClick }) => {
  const { state, syncDispatch } = useAppState();
  const { success: toastSuccess, error: toastError } = useToast();
  const task = state.tasks.find((t) => t.id === taskId);
  const project = task ? state.projects.find((p) => p.id === task.projectId) : null;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [bodyDraft, setBodyDraft] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);
  const linkTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!task && state.tasks.length > 0) onClose();
  }, [task, state.tasks.length, onClose]);

  useEffect(() => {
    if (!task?.projectId) return;
    let cancelled = false;
    api.members
      .list(task.projectId)
      .then((m) => {
        if (!cancelled) setMembers(m);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [task?.projectId]);

  useEffect(() => {
    if (isEditingTitle) titleRef.current?.focus();
  }, [isEditingTitle]);

  useEffect(() => {
    if (isAddingLink) linkTitleRef.current?.focus();
  }, [isAddingLink]);

  useEffect(() => {
    if (isEditingBody && bodyRef.current) {
      bodyRef.current.focus();
      bodyRef.current.style.height = 'auto';
      bodyRef.current.style.height = bodyRef.current.scrollHeight + 'px';
    }
  }, [isEditingBody]);

  if (!task) return null;

  const cycleStatus = () => {
    const next: Record<TaskStatus, TaskStatus> = {
      todo: 'in-progress',
      'in-progress': 'done',
      done: 'todo',
    };
    const newStatus = next[task.status];
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: {
        status: newStatus,
        completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
      },
    });
  };

  const saveTitle = () => {
    const title = titleDraft.trim();
    if (title && title !== task.title) {
      syncDispatch({ type: 'UPDATE_TASK', id: task.id, updates: { title } });
    }
    setIsEditingTitle(false);
  };

  const saveBody = () => {
    syncDispatch({ type: 'UPDATE_TASK', id: task.id, updates: { body: bodyDraft } });
    setIsEditingBody(false);
  };

  const addTag = () => {
    const tag = tagInput
      .replace(/^@/, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '');
    if (!tag || task.tags?.includes(tag)) {
      setTagInput('');
      return;
    }
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { tags: [...(task.tags || []), tag] },
    });
    setTagInput('');
    tagRef.current?.focus();
  };

  const removeTag = (tag: string) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { tags: (task.tags || []).filter((t) => t !== tag) },
    });
  };

  const addLink = () => {
    const title = newLinkTitle.trim();
    let url = newLinkUrl.trim();
    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const newLink = {
      id: Math.random().toString(36).substring(2, 9),
      title: title || url,
      url,
    };

    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { links: [...(task.links || []), newLink] },
    });

    setNewLinkTitle('');
    setNewLinkUrl('');
    setIsAddingLink(false);
  };

  const removeLink = (linkId: string) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { links: (task.links || []).filter((l) => l.id !== linkId) },
    });
  };

  const addSubtask = () => {
    const title = newSubtaskTitle.trim();
    if (!title) return;
    const newItem = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      done: false,
    };
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { subtasks: [...(task.subtasks || []), newItem] },
    });
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (id: string) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: {
        subtasks: (task.subtasks || []).map((s) =>
          s.id === id ? { ...s, done: !s.done } : s
        ),
      },
    });
  };

  const removeSubtask = (id: string) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { subtasks: (task.subtasks || []).filter((s) => s.id !== id) },
    });
  };

  const setDueDate = (dateStr: string) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { dueDate: dateStr || undefined },
    });
  };

  const setStartDate = (dateStr: string) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { startDate: dateStr || undefined },
    });
  };

  const setPriority = (priority: TaskPriority) => {
    syncDispatch({ type: 'UPDATE_TASK', id: task.id, updates: { priority } });
  };

  const setAssignee = (assigneeId: string | null) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { assigneeId: assigneeId ?? '' },
    });
  };

  const setRecurrence = (recurrence: TaskRecurrence | null) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { recurrence: recurrence ?? undefined },
    });
  };

  const handleDelete = () => {
    syncDispatch({ type: 'DELETE_TASK', id: task.id });
    onClose();
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}?task=${task.id}`;
    try {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: task.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toastSuccess('Task link copied to clipboard');
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      toastError('Could not share task');
    }
  };

  const statusLabel: Record<TaskStatus, string> = {
    todo: 'To Do',
    'in-progress': 'In Progress',
    done: 'Done',
  };

  const statusActionLabel: Record<TaskStatus, string> = {
    todo: 'Start',
    'in-progress': 'Complete',
    done: 'Reopen',
  };

  const StatusActionIcon =
    task.status === 'todo' ? Play : task.status === 'in-progress' ? Check : RotateCcw;

  const dueDateInfo = task.dueDate ? getDueDateLabel(task.dueDate) : null;

  return (
    <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-xl flex flex-col max-h-[calc(100vh-2rem)] animate-fade-in overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={cycleStatus}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-surface-hover hover:bg-bg-tertiary text-text-secondary transition-base"
          >
            <StatusActionIcon size={12} />
            {statusActionLabel[task.status]}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-base"
            title="Share task"
          >
            <Share2 size={14} />
            Share
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger-bg transition-base"
            title="Delete task"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-base"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-6 space-y-6 min-h-0">
        {/* Status + Project badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${
              task.status === 'done'
                ? 'bg-status-active-bg text-status-active'
                : task.status === 'in-progress'
                  ? 'bg-accent-light text-accent'
                  : 'bg-bg-tertiary text-text-secondary'
            }`}
          >
            {statusLabel[task.status]}
          </span>

          {project && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-text-secondary">
              <ProjectIcon
                projectId={project.id}
                color={project.color}
                iconSeed={project.iconSeed}
                size={16}
              />
              {project.name}
            </span>
          )}
        </div>

        {/* Title */}
        {isEditingTitle ? (
          <input
            ref={titleRef}
            type="text"
            className="w-full text-xl font-semibold text-text-primary bg-transparent outline-none border-b-2 border-accent pb-1"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveTitle();
              if (e.key === 'Escape') setIsEditingTitle(false);
            }}
            onBlur={saveTitle}
          />
        ) : (
          <h2
            className={`text-xl font-semibold tracking-tight cursor-pointer hover:text-accent transition-base ${
              task.status === 'done' ? 'line-through text-text-tertiary' : 'text-text-primary'
            }`}
            onClick={() => {
              setTitleDraft(task.title);
              setIsEditingTitle(true);
            }}
          >
            {task.title}
          </h2>
        )}

        {/* Start date */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={14} className="text-text-tertiary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Start Date
            </span>
          </div>
          <div className="flex items-center gap-3">
            <DatePicker
              value={task.startDate}
              onChange={(d) => setStartDate(d)}
              onClear={() => setStartDate('')}
            />
            {!task.startDate && (
              <span className="text-[12px] text-text-tertiary italic">
                Defaults to {format(new Date(task.createdAt), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>

        {/* Due date */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock size={14} className="text-text-tertiary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Due Date
            </span>
          </div>
          <div className="flex items-center gap-3">
            <DatePicker
              value={task.dueDate}
              onChange={(d) => setDueDate(d)}
              onClear={() => setDueDate('')}
            />
            {dueDateInfo && (
              <span className={`text-[12px] font-medium ${dueDateInfo.className}`}>
                {dueDateInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Priority */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Flag size={14} className="text-text-tertiary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Priority
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['none', 'low', 'medium', 'high'] as TaskPriority[]).map((p) => {
              const active = (task.priority ?? 'none') === p;
              const colorClass =
                p === 'high'
                  ? active
                    ? 'bg-danger text-white'
                    : 'text-danger hover:bg-danger-bg'
                  : p === 'medium'
                    ? active
                      ? 'bg-status-warning text-white'
                      : 'text-status-warning hover:bg-status-warning-bg'
                    : p === 'low'
                      ? active
                        ? 'bg-accent text-white'
                        : 'text-accent hover:bg-accent-light'
                      : active
                        ? 'bg-surface-hover text-text-primary'
                        : 'text-text-tertiary hover:bg-surface-hover';
              return (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-medium capitalize transition-base ${colorClass}`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recurrence */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={14} className="text-text-tertiary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Repeat
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { value: null, label: 'Never' },
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'biweekly', label: 'Biweekly' },
                { value: 'monthly', label: 'Monthly' },
              ] as { value: TaskRecurrence | null; label: string }[]
            ).map(({ value, label }) => {
              const active = (task.recurrence ?? null) === value;
              return (
                <button
                  key={label}
                  onClick={() => setRecurrence(value)}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-base ${
                    active
                      ? 'bg-accent text-text-inverse'
                      : 'text-text-tertiary hover:bg-surface-hover'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {task.recurrence && !task.dueDate && (
            <p className="mt-2 text-2xs text-status-warning">
              Set a due date to activate recurring behavior.
            </p>
          )}
        </div>

        {/* Assignee */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UserCircle2 size={14} className="text-text-tertiary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Assignee
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setAssignee(null)}
              className={`px-2.5 py-1 rounded-full text-[12px] font-medium transition-base ${
                !task.assigneeId
                  ? 'bg-surface-hover text-text-primary'
                  : 'text-text-tertiary hover:bg-surface-hover'
              }`}
            >
              Unassigned
            </button>
            {members.map((m) => {
              const active = task.assigneeId === m.userId;
              return (
                <button
                  key={m.userId}
                  onClick={() => setAssignee(active ? null : m.userId)}
                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 rounded-full text-[12px] font-medium transition-base ${
                    active
                      ? 'bg-accent text-text-inverse'
                      : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                  title={m.email}
                >
                  <Avatar seed={m.avatarSeed ?? m.userId} name={m.name} size={20} className="rounded-full" />
                  <span className="truncate max-w-[120px]">{m.name}</span>
                </button>
              );
            })}
            {members.length === 0 && (
              <span className="text-2xs text-text-tertiary italic">Loading members…</span>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Tag size={14} className="text-text-tertiary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              Tags
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(task.tags || []).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent-light text-accent text-[12px] font-medium group/tag"
              >
                <button onClick={() => onTagClick?.(tag)} className="hover:underline">
                  @{tag}
                </button>
                <button
                  onClick={() => removeTag(tag)}
                  className="opacity-0 group-hover/tag:opacity-100 hover:text-danger transition-base ml-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              ref={tagRef}
              type="text"
              className="bg-transparent text-[12px] text-text-primary outline-none min-w-[80px] max-w-[150px] placeholder:text-text-tertiary py-1"
              placeholder="+ add tag"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag();
                }
                if (e.key === 'Backspace' && !tagInput && task.tags?.length) {
                  removeTag(task.tags[task.tags.length - 1]);
                }
                if (e.key === 'Escape') {
                  setTagInput('');
                  tagRef.current?.blur();
                }
              }}
              onBlur={() => {
                if (tagInput.trim()) addTag();
              }}
            />
          </div>
        </div>

        {/* Subtasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ListChecks size={14} className="text-text-tertiary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Checklist
              </span>
            </div>
            {task.subtasks && task.subtasks.length > 0 && (
              <span className="text-2xs text-text-tertiary">
                {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
              </span>
            )}
          </div>

          {task.subtasks && task.subtasks.length > 0 && (
            <div className="h-1 bg-surface rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-status-active transition-all duration-300"
                style={{
                  width: `${(task.subtasks.filter((s) => s.done).length / task.subtasks.length) * 100}%`,
                }}
              />
            </div>
          )}

          <div className="space-y-1">
            {(task.subtasks || []).map((sub) => (
              <div
                key={sub.id}
                className="group/sub flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-hover transition-base"
              >
                <button
                  onClick={() => toggleSubtask(sub.id)}
                  className="flex-shrink-0 text-text-tertiary hover:text-accent transition-base"
                >
                  {sub.done ? (
                    <CheckSquare size={16} className="text-status-active" />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
                <span
                  className={`flex-1 text-[13px] ${
                    sub.done ? 'line-through text-text-tertiary' : 'text-text-primary'
                  }`}
                >
                  {sub.title}
                </span>
                <button
                  onClick={() => removeSubtask(sub.id)}
                  className="opacity-0 group-hover/sub:opacity-100 p-0.5 rounded text-text-tertiary hover:text-danger transition-base"
                >
                  <X size={12} />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-2 px-2 py-1">
              <Plus size={14} className="text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                placeholder="Add a checklist item..."
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addSubtask();
                }}
                className="flex-1 bg-transparent text-[13px] text-text-primary placeholder-text-tertiary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Links */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <LinkIcon size={14} className="text-text-tertiary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Links & Attachments
              </span>
            </div>
            {!isAddingLink && (
              <button
                onClick={() => setIsAddingLink(true)}
                className="text-2xs text-text-tertiary hover:text-accent transition-base flex items-center gap-1"
              >
                <Plus size={12} />
                Add
              </button>
            )}
          </div>

          <div className="space-y-2">
            {(task.links || []).map((link) => (
              <div
                key={link.id}
                className="group/link flex items-center justify-between p-2 rounded-lg hover:bg-surface-hover border border-transparent hover:border-border transition-base"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 min-w-0"
                >
                  <Link2 size={14} className="text-accent flex-shrink-0" />
                  <span className="text-[13px] text-text-primary truncate font-medium group-hover/link:text-accent transition-base">
                    {link.title}
                  </span>
                </a>
                <button
                  onClick={() => removeLink(link.id)}
                  className="opacity-0 group-hover/link:opacity-100 p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger-bg transition-base"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {isAddingLink && (
              <div className="p-3 rounded-lg bg-surface border border-accent/30 space-y-3 animate-in fade-in slide-in-from-top-2">
                <input
                  ref={linkTitleRef}
                  type="text"
                  placeholder="Link title (optional)"
                  className="w-full bg-transparent text-[13px] text-text-primary outline-none border-b border-border focus:border-accent pb-1"
                  value={newLinkTitle}
                  onChange={(e) => setNewLinkTitle(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Paste URL..."
                  className="w-full bg-transparent text-[13px] text-text-primary outline-none border-b border-border focus:border-accent pb-1"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addLink();
                    if (e.key === 'Escape') setIsAddingLink(false);
                  }}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsAddingLink(false)}
                    className="px-2 py-1 text-[11px] text-text-secondary hover:text-text-primary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addLink}
                    disabled={!newLinkUrl.trim()}
                    className="px-3 py-1 bg-accent text-text-inverse text-[11px] font-medium rounded-md hover:bg-accent-hover disabled:opacity-50"
                  >
                    Add Link
                  </button>
                </div>
              </div>
            )}

            {!isAddingLink && (!task.links || task.links.length === 0) && (
              <p className="text-[12px] text-text-tertiary italic px-1">No links added yet.</p>
            )}
          </div>
        </div>

        {/* Body / Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Pencil size={14} className="text-text-tertiary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Notes
              </span>
            </div>
            {!isEditingBody && (task.body || '').trim() && (
              <button
                onClick={() => {
                  setBodyDraft(task.body || '');
                  setIsEditingBody(true);
                }}
                className="text-2xs text-text-tertiary hover:text-accent transition-base"
              >
                Edit
              </button>
            )}
          </div>

          {isEditingBody ? (
            <div>
              <textarea
                ref={bodyRef}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-[14px] text-text-primary outline-none focus:border-accent resize-none min-h-[120px] leading-relaxed"
                value={bodyDraft}
                onChange={(e) => {
                  setBodyDraft(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                placeholder="Write notes in markdown..."
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setIsEditingBody(false)}
                  className="px-3 py-1.5 text-[12px] text-text-secondary hover:text-text-primary rounded-lg transition-base"
                >
                  Cancel
                </button>
                <button
                  onClick={saveBody}
                  className="px-3 py-1.5 text-[12px] bg-accent text-text-inverse rounded-lg hover:bg-accent-hover transition-base font-medium"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div
              className="cursor-pointer rounded-lg hover:bg-surface-hover p-3 -mx-3 transition-base min-h-[60px]"
              onClick={() => {
                setBodyDraft(task.body || '');
                setIsEditingBody(true);
              }}
            >
              {(task.body || '').trim() ? (
                <div className="markdown-body">
                  <ReactMarkdown>{task.body!}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[13px] text-text-tertiary italic">Click to add notes...</p>
              )}
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="pt-4 border-t border-border">
          <Comments taskId={task.id} members={members} />
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
            <Calendar size={13} />
            <span>Created {format(new Date(task.createdAt), 'MMM d, yyyy · h:mm a')}</span>
          </div>
          {task.completedAt && (
            <div className="flex items-center gap-2 text-[12px] text-text-tertiary">
              <Check size={13} />
              <span>Completed {format(new Date(task.completedAt), 'MMM d, yyyy · h:mm a')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetail;
