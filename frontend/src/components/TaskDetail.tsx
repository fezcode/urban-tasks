import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppState';
import type { TaskStatus } from '../context/types';
import ReactMarkdown from 'react-markdown';
import {
  X,
  ArrowLeft,
  Trash2,
  Calendar,
  Tag,
  Check,
  Play,
  RotateCcw,
  Pencil,
  CalendarClock,
} from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import ProjectIcon from './ProjectIcon';
import DatePicker from './DatePicker';

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
  const task = state.tasks.find((t) => t.id === taskId);
  const project = task ? state.projects.find((p) => p.id === task.projectId) : null;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isEditingBody, setIsEditingBody] = useState(false);
  const [bodyDraft, setBodyDraft] = useState('');
  const [tagInput, setTagInput] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const tagRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!task) onClose();
  }, [task, onClose]);

  useEffect(() => {
    if (isEditingTitle) titleRef.current?.focus();
  }, [isEditingTitle]);

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

  const setDueDate = (dateStr: string) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: { dueDate: dateStr || undefined },
    });
  };

  const handleDelete = () => {
    syncDispatch({ type: 'DELETE_TASK', id: task.id });
    onClose();
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
    <aside
      className="
        fixed inset-0 z-50 bg-bg
        lg:relative lg:inset-auto lg:z-auto lg:w-[420px] lg:flex-shrink-0 lg:border-l lg:border-border
        flex flex-col overflow-hidden animate-fade-in
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-5 py-3 border-b border-border flex-shrink-0">
        <button
          onClick={onClose}
          className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-base"
        >
          <ArrowLeft size={18} className="lg:hidden" />
          <X size={18} className="hidden lg:block" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={cycleStatus}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-surface-hover hover:bg-bg-tertiary text-text-secondary transition-base"
          >
            <StatusActionIcon size={12} />
            {statusActionLabel[task.status]}
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger-bg transition-base"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 lg:px-6 py-6 space-y-6">
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
    </aside>
  );
};

export default TaskDetail;
