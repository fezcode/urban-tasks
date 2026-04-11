import React, { useState } from 'react';
import { useAppState } from '../context/AppState';
import type { Task, TaskStatus } from '../context/types';
import { Trash2, Play, RotateCcw, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Props {
  task: Task;
  showProject?: boolean;
}

const TaskItem: React.FC<Props> = ({ task, showProject }) => {
  const { state, dispatch } = useAppState();
  const [isHovered, setIsHovered] = useState(false);

  const project = state.projects.find((p) => p.id === task.projectId);

  const cycleStatus = () => {
    const next: Record<TaskStatus, TaskStatus> = {
      todo: 'in-progress',
      'in-progress': 'done',
      done: 'todo',
    };
    const newStatus = next[task.status];
    dispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: {
        status: newStatus,
        completedAt: newStatus === 'done' ? new Date().toISOString() : undefined,
      },
    });
  };

  const setStatus = (status: TaskStatus) => {
    dispatch({
      type: 'UPDATE_TASK',
      id: task.id,
      updates: {
        status,
        completedAt: status === 'done' ? new Date().toISOString() : undefined,
      },
    });
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_TASK', id: task.id });
  };

  const statusColors: Record<TaskStatus, string> = {
    todo: 'border-border hover:border-text-tertiary',
    'in-progress': 'border-accent bg-accent/10',
    done: 'border-status-active bg-status-active',
  };

  return (
    <div
      className={`group flex items-start gap-3.5 px-4 py-3.5 rounded-xl transition-base ${
        task.status === 'done' ? 'opacity-60' : ''
      } hover:bg-surface-hover`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Status circle */}
      <button
        onClick={cycleStatus}
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

        <div className="flex items-center gap-2 mt-1.5">
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
        className={`flex items-center gap-0.5 transition-base ${
          isHovered ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {task.status === 'todo' && (
          <button
            onClick={() => setStatus('in-progress')}
            className="p-1.5 rounded-md text-text-tertiary hover:text-accent hover:bg-accent-light transition-base"
            title="Start"
          >
            <Play size={14} />
          </button>
        )}
        {task.status === 'in-progress' && (
          <button
            onClick={() => setStatus('done')}
            className="p-1.5 rounded-md text-text-tertiary hover:text-status-active hover:bg-status-active-bg transition-base"
            title="Complete"
          >
            <Check size={14} />
          </button>
        )}
        {task.status === 'done' && (
          <button
            onClick={() => setStatus('todo')}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-base"
            title="Reopen"
          >
            <RotateCcw size={14} />
          </button>
        )}
        <button
          onClick={handleDelete}
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
