import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppState } from '../context/AppState';
import { useTheme } from '../context/ThemeContext';
import type { TaskStatus } from '../context/types';
import type { View } from './Sidebar';
import {
  Search,
  Plus,
  LayoutDashboard,
  ListTodo,
  Sun,
  Moon,
  Tag,
  Trash2,
  Check,
} from 'lucide-react';

type ResultType = 'action' | 'task' | 'tag' | 'header';

interface ResultItem {
  type: ResultType;
  id: string;
  label: string;
  detail?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  status?: TaskStatus;
  projectColor?: string;
}

interface Props {
  onClose: () => void;
  onSelectTask: (id: string) => void;
  onCreateTask: () => void;
  onTagClick: (tag: string) => void;
  onViewChange: (view: View) => void;
}

const CommandPalette: React.FC<Props> = ({
  onClose,
  onSelectTask,
  onCreateTask,
  onTagClick,
  onViewChange,
}) => {
  const { state, dispatch } = useAppState();
  const { theme, toggle: toggleTheme } = useTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Build tag map
  const tagMap = useMemo(() => {
    const map = new Map<string, number>();
    state.tasks.forEach((t) => t.tags?.forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1)));
    return map;
  }, [state.tasks]);

  // Compute results
  const results = useMemo((): ResultItem[] => {
    const items: ResultItem[] = [];
    const q = query.trim().toLowerCase();
    const isTagMode = q.startsWith('@');
    const searchTerm = isTagMode ? q.slice(1) : q;

    if (!q) {
      // Default: quick actions + all tags
      items.push({ type: 'header', id: 'h-actions', label: 'Quick Actions' });
      items.push({ type: 'action', id: 'new-task', label: 'New Task', icon: Plus });
      items.push({ type: 'action', id: 'go-tasks', label: 'Go to Tasks', icon: ListTodo });
      items.push({
        type: 'action',
        id: 'go-dashboard',
        label: 'Go to Dashboard',
        icon: LayoutDashboard,
      });
      items.push({
        type: 'action',
        id: 'toggle-theme',
        label: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`,
        icon: theme === 'light' ? Moon : Sun,
      });

      if (tagMap.size > 0) {
        items.push({ type: 'header', id: 'h-tags', label: 'Tags' });
        tagMap.forEach((count, tag) => {
          items.push({
            type: 'tag',
            id: `tag:${tag}`,
            label: `@${tag}`,
            detail: `${count} task${count !== 1 ? 's' : ''}`,
          });
        });
      }

      return items;
    }

    if (isTagMode) {
      // Tag search mode
      const matching: ResultItem[] = [];
      tagMap.forEach((count, tag) => {
        if (!searchTerm || tag.includes(searchTerm)) {
          matching.push({
            type: 'tag',
            id: `tag:${tag}`,
            label: `@${tag}`,
            detail: `${count} task${count !== 1 ? 's' : ''}`,
          });
        }
      });
      if (matching.length > 0) {
        items.push({ type: 'header', id: 'h-tags', label: 'Tags' });
        items.push(...matching);
      }
      return items;
    }

    // General search: tasks + tags + actions
    const matchingTasks: ResultItem[] = [];
    state.tasks.forEach((task) => {
      const titleMatch = task.title.toLowerCase().includes(q);
      const bodyMatch = task.body?.toLowerCase().includes(q);
      const tagMatch = task.tags?.some((t) => t.includes(q));
      if (titleMatch || bodyMatch || tagMatch) {
        const project = state.projects.find((p) => p.id === task.projectId);
        matchingTasks.push({
          type: 'task',
          id: task.id,
          label: task.title,
          detail: project?.name,
          status: task.status,
          projectColor: project?.color,
        });
      }
    });
    if (matchingTasks.length > 0) {
      items.push({ type: 'header', id: 'h-tasks', label: 'Tasks' });
      items.push(...matchingTasks.slice(0, 10));
    }

    const matchingTags: ResultItem[] = [];
    tagMap.forEach((count, tag) => {
      if (tag.includes(q)) {
        matchingTags.push({
          type: 'tag',
          id: `tag:${tag}`,
          label: `@${tag}`,
          detail: `${count} task${count !== 1 ? 's' : ''}`,
        });
      }
    });
    if (matchingTags.length > 0) {
      items.push({ type: 'header', id: 'h-tags', label: 'Tags' });
      items.push(...matchingTags);
    }

    const actions: Omit<ResultItem, 'type'>[] = [
      { id: 'new-task', label: 'New Task', icon: Plus },
      { id: 'go-tasks', label: 'Go to Tasks', icon: ListTodo },
      { id: 'go-dashboard', label: 'Go to Dashboard', icon: LayoutDashboard },
      {
        id: 'toggle-theme',
        label: `Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`,
        icon: theme === 'light' ? Moon : Sun,
      },
    ];
    const matchingActions = actions.filter((a) => a.label.toLowerCase().includes(q));
    if (matchingActions.length > 0) {
      items.push({ type: 'header', id: 'h-actions', label: 'Actions' });
      matchingActions.forEach((a) => items.push({ type: 'action', ...a }));
    }

    return items;
  }, [query, state.tasks, state.projects, tagMap, theme]);

  // Selectable items (exclude headers)
  const selectableIndices = useMemo(
    () => results.map((r, i) => (r.type !== 'header' ? i : -1)).filter((i) => i !== -1),
    [results]
  );

  // Derived clamped index — no state update needed
  const effectiveIndex = Math.min(activeIndex, Math.max(0, selectableIndices.length - 1));

  const handleSelect = (item: ResultItem) => {
    if (item.type === 'header') return;
    switch (item.type) {
      case 'task':
        onSelectTask(item.id);
        break;
      case 'tag':
        onTagClick(item.label.slice(1));
        break;
      case 'action':
        if (item.id === 'new-task') onCreateTask();
        else if (item.id === 'go-tasks') onViewChange('tasks');
        else if (item.id === 'go-dashboard') onViewChange('dashboard');
        else if (item.id === 'toggle-theme') toggleTheme();
        break;
    }
    onClose();
  };

  const handleDeleteTask = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    dispatch({ type: 'DELETE_TASK', id: taskId });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, selectableIndices.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const realIndex = selectableIndices[effectiveIndex];
      if (realIndex !== undefined && results[realIndex]) {
        handleSelect(results[realIndex]);
      }
      return;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const realIndex = selectableIndices[effectiveIndex];
    if (realIndex === undefined) return;
    const el = listRef.current?.children[realIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [effectiveIndex, selectableIndices]);

  const statusDot: Record<TaskStatus, string> = {
    todo: 'bg-border',
    'in-progress': 'bg-accent',
    done: 'bg-status-active',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4">
      <div className="fixed inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-2xl shadow-lg overflow-hidden animate-slide-down">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border">
          <Search size={18} className="text-text-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-[15px] text-text-primary outline-none placeholder:text-text-tertiary"
            placeholder={
              query.startsWith('@') ? 'Search tags...' : 'Search tasks, @tags, or type a command...'
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="text-2xs text-text-tertiary bg-bg-secondary px-1.5 py-0.5 rounded font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-text-tertiary">
              No results found
            </div>
          )}
          {results.map((item, i) => {
            if (item.type === 'header') {
              return (
                <div
                  key={item.id}
                  className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary"
                >
                  {item.label}
                </div>
              );
            }

            const selectIdx = selectableIndices.indexOf(i);
            const isActive = selectIdx === effectiveIndex;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-base group/result ${
                  isActive ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                }`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setActiveIndex(selectIdx)}
              >
                {/* Icon */}
                {item.type === 'action' && Icon && (
                  <Icon size={16} className="text-text-tertiary flex-shrink-0" />
                )}
                {item.type === 'task' && (
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDot[item.status || 'todo']}`}
                  />
                )}
                {item.type === 'tag' && <Tag size={14} className="text-accent flex-shrink-0" />}

                {/* Label */}
                <span
                  className={`flex-1 text-[14px] truncate ${
                    item.type === 'tag'
                      ? 'text-accent font-medium'
                      : item.status === 'done'
                        ? 'text-text-tertiary line-through'
                        : 'text-text-primary'
                  }`}
                >
                  {item.label}
                </span>

                {/* Detail */}
                {item.detail && (
                  <span className="text-2xs text-text-tertiary flex-shrink-0">{item.detail}</span>
                )}

                {/* Task delete button */}
                {item.type === 'task' && (
                  <button
                    onClick={(e) => handleDeleteTask(e, item.id)}
                    className="p-1 rounded opacity-0 group-hover/result:opacity-100 text-text-tertiary hover:text-danger hover:bg-danger-bg transition-base flex-shrink-0"
                    title="Delete task"
                  >
                    <Trash2 size={13} />
                  </button>
                )}

                {/* Active indicator */}
                {isActive && item.type !== 'task' && (
                  <Check size={14} className="text-text-tertiary flex-shrink-0 opacity-30" />
                )}
              </button>
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-2xs text-text-tertiary">
          <span className="flex items-center gap-1">
            <kbd className="bg-bg-secondary px-1 py-0.5 rounded font-mono">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-bg-secondary px-1 py-0.5 rounded font-mono">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-bg-secondary px-1 py-0.5 rounded font-mono">@</kbd> Tags
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
