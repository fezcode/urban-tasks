import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppState';
import TaskItem from './TaskItem';
import Dashboard from './Dashboard';
import {
  Plus,
  CheckCircle2,
  ListFilter,
  Menu,
  ChevronRight,
  Search,
  X,
  CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Task, TaskStatus } from '../context/types';
import type { View } from './Sidebar';
import ProjectIcon from './ProjectIcon';

type Filter = 'all' | 'todo' | 'in-progress' | 'done';

interface Props {
  currentView: View;
  onMenuClick: () => void;
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  activeTag: string | null;
  onTagClick: (tag: string) => void;
  onClearTag: () => void;
  showDueToday?: boolean;
  onClearDueToday?: () => void;
  onOpenCommandPalette: () => void;
}

const MainContent: React.FC<Props> = ({
  currentView,
  onMenuClick,
  selectedTaskId,
  onSelectTask,
  activeTag,
  onTagClick,
  onClearTag,
  showDueToday,
  onClearDueToday,
  onOpenCommandPalette,
}) => {
  const { state, dispatch } = useAppState();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  // Listen for add-task events from command palette
  useEffect(() => {
    const handler = () => setIsAdding(true);
    window.addEventListener('urban-tasks:add', handler);
    return () => window.removeEventListener('urban-tasks:add', handler);
  }, []);

  // Clear selection if task is no longer in visible list
  useEffect(() => {
    if (selectedTaskId) {
      const visible = state.activeProjectId
        ? state.tasks.filter((t) => t.projectId === state.activeProjectId)
        : state.tasks;
      if (!visible.find((t) => t.id === selectedTaskId)) {
        onSelectTask(null);
      }
    }
  }, [state.activeProjectId, state.tasks, selectedTaskId, onSelectTask]);

  const activeProject = state.activeProjectId
    ? state.projects.find((p) => p.id === state.activeProjectId)
    : null;

  const projectTasks = state.activeProjectId
    ? state.tasks.filter((t) => t.projectId === state.activeProjectId)
    : state.tasks;

  // Apply due-today filter
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dueTodayFilteredTasks = showDueToday
    ? projectTasks.filter((t) => t.dueDate === todayStr)
    : projectTasks;

  // Apply tag filter
  const tagFilteredTasks = activeTag
    ? dueTodayFilteredTasks.filter((t) => t.tags?.includes(activeTag))
    : dueTodayFilteredTasks;

  const filteredTasks =
    filter === 'all' ? tagFilteredTasks : tagFilteredTasks.filter((t) => t.status === filter);

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const order: Record<TaskStatus, number> = { 'in-progress': 0, todo: 1, done: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const todoCount = tagFilteredTasks.filter((t) => t.status === 'todo').length;
  const activeCount = tagFilteredTasks.filter((t) => t.status === 'in-progress').length;
  const doneCount = tagFilteredTasks.filter((t) => t.status === 'done').length;

  const handleAddTask = () => {
    const title = newTaskTitle.trim();
    if (!title) {
      setIsAdding(false);
      return;
    }
    const targetProject = state.activeProjectId || state.projects[0]?.id || 'personal';
    const task: Task = {
      id: Date.now().toString(),
      title,
      status: 'todo',
      projectId: targetProject,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_TASK', task });
    setNewTaskTitle('');
    inputRef.current?.focus();
  };

  const toggleCollapse = (id: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group tasks by project (for "All Projects" view)
  const groupedTasks = state.projects
    .map((project) => ({
      project,
      tasks: sortedTasks.filter((t) => t.projectId === project.id),
    }))
    .filter((g) => g.tasks.length > 0);

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: tagFilteredTasks.length },
    { key: 'todo', label: 'To do', count: todoCount },
    { key: 'in-progress', label: 'Active', count: activeCount },
    { key: 'done', label: 'Done', count: doneCount },
  ];

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-4 sm:px-6 lg:px-10 pt-6 lg:pt-10 pb-4 lg:pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={onMenuClick}
              className="p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-base"
              title="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            {activeProject && (
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: activeProject.color }}
              />
            )}
            <h1 className="text-xl lg:text-2xl font-semibold text-text-primary tracking-tight truncate">
              {currentView === 'dashboard'
                ? activeProject
                  ? `${activeProject.name} — Dashboard`
                  : 'Dashboard'
                : showDueToday
                  ? 'Today'
                  : activeProject
                    ? activeProject.name
                    : 'All Tasks'}
            </h1>
            <div className="ml-auto flex-shrink-0">
              <button
                onClick={onOpenCommandPalette}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-secondary hover:bg-bg-tertiary text-text-tertiary hover:text-text-secondary text-[13px] transition-base"
                title={`Search (${isMac ? '⌘' : 'Ctrl+'}K)`}
              >
                <Search size={14} />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden sm:inline text-2xs bg-surface px-1.5 py-0.5 rounded font-mono ml-1">
                  {isMac ? '⌘K' : 'Ctrl+K'}
                </kbd>
              </button>
            </div>
          </div>
          {currentView === 'tasks' && (
            <p className="text-[13px] text-text-tertiary mt-1 ml-11">
              {tagFilteredTasks.length === 0
                ? activeTag
                  ? `No tasks tagged @${activeTag}`
                  : 'No tasks yet. Create one to get started.'
                : `${todoCount + activeCount} remaining · ${doneCount} completed`}
            </p>
          )}
        </div>
      </header>

      {currentView === 'dashboard' ? (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-10">
          <div className="max-w-4xl">
            <Dashboard />
          </div>
        </div>
      ) : (
        <>
          {/* Filter banners */}
          {(activeTag || showDueToday) && (
            <div className="flex-shrink-0 px-4 sm:px-6 lg:px-10 pb-3 flex flex-wrap gap-2">
              {showDueToday && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-status-warning-bg text-status-warning text-[13px] font-medium">
                  <CalendarDays size={13} />
                  <span>Due today</span>
                  <button
                    onClick={onClearDueToday}
                    className="p-0.5 rounded-full hover:bg-status-warning/20 transition-base"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {activeTag && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-light text-accent text-[13px] font-medium">
                  <span>Filtered by @{activeTag}</span>
                  <button
                    onClick={onClearTag}
                    className="p-0.5 rounded-full hover:bg-accent/20 transition-base"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Filters + Add button */}
          <div className="flex-shrink-0 px-4 sm:px-6 lg:px-10 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-1 overflow-x-auto no-scrollbar">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-md text-[13px] whitespace-nowrap transition-base ${
                      filter === f.key
                        ? 'bg-surface text-text-primary shadow-sm font-medium'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className="ml-1.5 text-2xs text-text-tertiary">{f.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-accent text-text-inverse rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-base active:scale-[0.97] flex-shrink-0"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add task</span>
              </button>
            </div>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-10">
            <div>
              {isAdding && (
                <div className="mb-3 animate-slide-down">
                  <div className="flex items-center gap-3 bg-surface border border-border-focus rounded-xl px-4 py-3 shadow-sm">
                    <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      className="flex-1 bg-transparent text-[14px] text-text-primary outline-none"
                      placeholder="What needs to be done?"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddTask();
                        if (e.key === 'Escape') {
                          setIsAdding(false);
                          setNewTaskTitle('');
                        }
                      }}
                    />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleAddTask}
                        className="p-1.5 rounded-md bg-accent text-text-inverse hover:bg-accent-hover transition-base"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setIsAdding(false);
                          setNewTaskTitle('');
                        }}
                        className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-secondary transition-base"
                      >
                        <span className="text-xs">Esc</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {sortedTasks.length > 0 ? (
                !state.activeProjectId ? (
                  // Grouped by project
                  <div className="space-y-2">
                    {groupedTasks.map(({ project, tasks: groupTasks }) => (
                      <div key={project.id}>
                        <button
                          onClick={() => toggleCollapse(project.id)}
                          className="flex items-center gap-2.5 px-3 py-2 w-full text-left rounded-lg hover:bg-surface-hover transition-base"
                        >
                          <ChevronRight
                            size={14}
                            className={`text-text-tertiary transition-transform duration-150 ${
                              !collapsedProjects.has(project.id) ? 'rotate-90' : ''
                            }`}
                          />
                          <ProjectIcon
                            projectId={project.id}
                            color={project.color}
                            iconSeed={project.iconSeed}
                            size={18}
                          />
                          <span className="text-[13px] font-medium text-text-primary">
                            {project.name}
                          </span>
                          <span className="text-2xs text-text-tertiary ml-auto tabular-nums">
                            {groupTasks.length}
                          </span>
                        </button>
                        {!collapsedProjects.has(project.id) && (
                          <div className="space-y-0.5 mt-0.5 ml-2">
                            {groupTasks.map((task) => (
                              <TaskItem
                                key={task.id}
                                task={task}
                                isSelected={task.id === selectedTaskId}
                                onClick={() =>
                                  onSelectTask(task.id === selectedTaskId ? null : task.id)
                                }
                                onTagClick={onTagClick}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Flat list for single project
                  <div className="space-y-0.5">
                    {sortedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        isSelected={task.id === selectedTaskId}
                        onClick={() => onSelectTask(task.id === selectedTaskId ? null : task.id)}
                        onTagClick={onTagClick}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  {filter !== 'all' ? (
                    <>
                      <ListFilter size={32} className="text-text-tertiary/40 mb-3" />
                      <p className="text-[14px] text-text-tertiary">
                        No{' '}
                        {filter === 'done'
                          ? 'completed'
                          : filter === 'in-progress'
                            ? 'active'
                            : 'pending'}{' '}
                        tasks
                      </p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={40} className="text-text-tertiary/30 mb-4" />
                      <p className="text-[15px] text-text-secondary font-medium mb-1">
                        No tasks here yet
                      </p>
                      <p className="text-[13px] text-text-tertiary">
                        Click &quot;Add task&quot; to create your first task
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default MainContent;
