import React, { useState } from 'react';
import { useAppState } from '../context/AppState';
import type { Task, TaskStatus, TaskPriority } from '../context/types';
import { Trash2, Play, RotateCcw, Check, CalendarClock, Flag, Link2, ListChecks } from 'lucide-react';
import { formatDistanceToNow, differenceInDays, startOfDay, format } from 'date-fns';

interface Props {
  task: Task;
  showProject?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onTagClick?: (tag: string) => void;
}

export const PRIORITY_META: Record<TaskPriority, { label: string; className: string } | null> = {
  none: null,
  low: { label: 'Low', className: 'text-text-tertiary' },
  medium: { label: 'Med', className: 'text-status-warning' },
  high: { label: 'High', className: 'text-danger' },
};

function getDueDateInfo(dueDate: string): { label: string; className: string } {
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate));
  const diff = differenceInDays(due, today);

  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, className: 'text-danger' };
  if (diff === 0) return { label: 'Due today', className: 'text-status-warning' };
  if (diff === 1) return { label: 'Tomorrow', className: 'text-text-secondary' };
  if (diff <= 7) return { label: `${diff}d left`, className: 'text-text-tertiary' };
  return { label: format(due, 'MMM d'), className: 'text-text-tertiary' };
}

const TaskItem: React.FC<Props> = ({ task, showProject, isSelected, onClick, onTagClick }) => {
  const { state, syncDispatch } = useAppState();
  const [isHovered, setIsHovered] = useState(false);

  const project = state.projects.find((p) => p.id === task.projectId);

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

  const setStatus = (status: TaskStatus) => {
    syncDispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: {
        status,
        completedAt: status === 'done' ? new Date().toISOString() : undefined,
      },
    });
  };

  const handleDelete = () => {
    syncDispatch({ type: 'DELETE_TASK', id: task.id });
  };

  const statusColors: Record<TaskStatus, string> = {
    todo: 'border-border hover:border-text-tertiary',
    'in-progress': 'border-accent bg-accent/10',
    done: 'border-status-active bg-status-active',
  };

  const dueDateInfo = task.dueDate ? getDueDateInfo(task.dueDate) : null;
  const priorityMeta = PRIORITY_META[task.priority ?? 'none'];

  return (
    <div
      className={`group flex items-start gap-3 sm:gap-3.5 px-3 sm:px-4 py-3 sm:py-3.5 rounded-xl transition-base cursor-pointer ${
        isSelected ? 'bg-surface shadow-sm ring-1 ring-border' : 'hover:bg-surface-hover'
      } ${task.status === 'done' ? 'opacity-60' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status circle */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          cycleStatus();
        }}
        className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-base ${statusColors[task.status]}`}
        title={`Status: ${task.status}`}
      >
        {task.status === 'done' && <Check size={12} className="text-white" strokeWidth={3} />}
        {task.status === 'in-progress' && <div className="w-2 h-2 rounded-full bg-accent" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-[14px] leading-snug ${
            task.status === 'done' ? 'line-through text-text-tertiary' : 'text-text-primary'
          }`}
        >
          {task.title}
        </p>

        {/* Body preview */}
        {task.body && (
          <p className="text-2xs text-text-tertiary mt-1 line-clamp-1">
            {task.body.split('\n')[0].slice(0, 100)}
          </p>
        )}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Tags */}
          {task.tags &&
            task.tags.length > 0 &&
            task.tags.map((tag) => (
              <button
                key={tag}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag);
                }}
                className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-accent-light text-accent text-2xs font-medium hover:bg-accent-muted transition-base"
              >
                @{tag}
              </button>
            ))}

          {/* Priority */}
          {priorityMeta && task.status !== 'done' && (
            <span
              className={`inline-flex items-center gap-1 text-2xs font-medium ${priorityMeta.className}`}
            >
              <Flag size={11} />
              {priorityMeta.label}
            </span>
          )}

          {/* Due date */}
          {dueDateInfo && task.status !== 'done' && (
            <span className={`inline-flex items-center gap-1 text-2xs ${dueDateInfo.className}`}>
              <CalendarClock size={11} />
              {dueDateInfo.label}
            </span>
          )}

          {task.links && task.links.length > 0 && (
            <span className="inline-flex items-center gap-1 text-2xs text-text-tertiary">
              <Link2 size={11} className="text-accent" />
              {task.links.length}
            </span>
          )}

          {task.subtasks && task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-1 text-2xs text-text-tertiary">
              <ListChecks size={11} className="text-accent" />
              {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
            </span>
          )}

          {showProject && project && (
            <span className="inline-flex items-center gap-1.5 text-2xs text-text-tertiary">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              {project.name}
            </span>
          )}
          <span className="text-2xs text-text-tertiary">
            {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div
        className={`hidden sm:flex items-center gap-0.5 transition-base ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {task.status === 'todo' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStatus('in-progress');
            }}
            className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent-light transition-base"
            title="Start"
          >
            <Play size={14} />
          </button>
        )}
        {task.status === 'in-progress' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStatus('done');
            }}
            className="p-1.5 rounded-md text-text-tertiary hover:text-status-active hover:bg-status-active-bg transition-base"
            title="Complete"
          >
            <Check size={14} />
          </button>
        )}
        {task.status === 'done' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setStatus('todo');
            }}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-base"
            title="Reopen"
          >
            <RotateCcw size={14} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDelete();
          }}
          className="p-1.5 rounded-md text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-base"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default TaskItem;
