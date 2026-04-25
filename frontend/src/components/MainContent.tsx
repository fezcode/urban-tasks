import React, { useState, useRef, useEffect, Suspense, lazy } from 'react';
import { useAppState } from '../context/AppState';
import { useToast } from '../context/ToastContext';
import { usePreferences } from '../context/PreferencesContext';
import TaskItem from './TaskItem';
import BlackHole from './BlackHole';
import BulkActionBar from './BulkActionBar';
import { parseQuickAdd } from '../lib/parseQuickAdd';

const Dashboard = lazy(() => import('./Dashboard'));
const Calendar = lazy(() => import('./Calendar'));
import {
  Plus,
  CheckCircle2,
  ListFilter,
  Menu,
  ChevronRight,
  Search,
  X,
  CalendarDays,
  CalendarRange,
  Archive as ArchiveIcon,
} from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import type { Task, TaskStatus } from '../context/types';
import type { View } from './Sidebar';
import ProjectIcon from './ProjectIcon';

type Filter = 'all' | 'todo' | 'in-progress' | 'done';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };

const PRIORITY_CHIP_STYLE: Record<Exclude<PriorityFilter, 'all'>, { active: string; idle: string; dot: string }> = {
  high: {
    active: 'bg-danger text-white border-danger',
    idle: 'text-danger border-danger/40 hover:bg-danger-bg',
    dot: 'bg-danger',
  },
  medium: {
    active: 'bg-status-warning text-white border-status-warning',
    idle: 'text-status-warning border-status-warning/40 hover:bg-status-warning-bg',
    dot: 'bg-status-warning',
  },
  low: {
    active: 'bg-accent text-white border-accent',
    idle: 'text-accent border-accent/40 hover:bg-accent-light',
    dot: 'bg-accent',
  },
};

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
  showUpcoming?: boolean;
  onClearUpcoming?: () => void;
  showArchive?: boolean;
  onClearArchive?: () => void;
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
  showUpcoming,
  onClearUpcoming,
  showArchive,
  onClearArchive,
  onOpenCommandPalette,
}) => {
  const { state, syncDispatch } = useAppState();
  const { error: toastError } = useToast();
  const { easterEggsEnabled } = usePreferences();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const lastClickedIdRef = useRef<string | null>(null);

  const clearBulkSelection = () => setBulkSelected(new Set());

  // Esc clears multi-select
  useEffect(() => {
    if (bulkSelected.size === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearBulkSelection();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [bulkSelected.size]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  // Apply saved-filter status/priority to local state when sidebar fires the event
  useEffect(() => {
    const handler = (e: Event) => {
      const def = (
        e as CustomEvent<{
          status?: 'all' | 'todo' | 'in-progress' | 'done';
          priority?: 'all' | 'high' | 'medium' | 'low';
        }>
      ).detail;
      if (!def) return;
      setFilter((def.status ?? 'all') as Filter);
      setPriorityFilter((def.priority ?? 'all') as PriorityFilter);
    };
    window.addEventListener('urban-tasks:apply-saved-filter', handler);
    return () => window.removeEventListener('urban-tasks:apply-saved-filter', handler);
  }, []);

  // Listen for add-task events from command palette
  useEffect(() => {
    const handler = () => {
      if (state.projects.length === 0) {
        toastError('Create a project first — tasks need a home.');
        return;
      }
      setIsAdding(true);
    };
    window.addEventListener('urban-tasks:add', handler);
    return () => window.removeEventListener('urban-tasks:add', handler);
  }, [state.projects.length, toastError]);

  // Clear selection if task is no longer in visible list (skip while tasks are still loading)
  useEffect(() => {
    if (!selectedTaskId || state.tasks.length === 0) return;
    const visible = state.activeProjectId
      ? state.tasks.filter((t) => t.projectId === state.activeProjectId)
      : state.tasks;
    if (!visible.find((t) => t.id === selectedTaskId)) {
      onSelectTask(null);
    }
  }, [state.activeProjectId, state.tasks, selectedTaskId, onSelectTask]);

  const activeProject = state.activeProjectId
    ? state.projects.find((p) => p.id === state.activeProjectId)
    : null;

  const projectTasks = state.activeProjectId
    ? state.tasks.filter((t) => t.projectId === state.activeProjectId)
    : state.tasks;

  // View-level scope: archive shows only done; all other views hide done
  const scopedTasks = showArchive
    ? projectTasks.filter((t) => t.status === 'done')
    : filter === 'done'
      ? projectTasks
      : projectTasks.filter((t) => t.status !== 'done');

  // Due-date views
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const today = startOfDay(new Date());
  const dateFilteredTasks = showDueToday
    ? scopedTasks.filter((t) => t.dueDate === todayStr)
    : showUpcoming
      ? scopedTasks.filter((t) => {
          if (!t.dueDate) return false;
          const diff = differenceInDays(startOfDay(new Date(t.dueDate)), today);
          return diff >= 0 && diff <= 7;
        })
      : scopedTasks;

  // Apply tag filter
  const tagFilteredTasks = activeTag
    ? dateFilteredTasks.filter((t) => t.tags?.includes(activeTag))
    : dateFilteredTasks;

  const statusFilteredTasks =
    filter === 'all' || showArchive
      ? tagFilteredTasks
      : tagFilteredTasks.filter((t) => t.status === filter);

  const filteredTasks =
    priorityFilter === 'all'
      ? statusFilteredTasks
      : statusFilteredTasks.filter((t) => (t.priority ?? 'none') === priorityFilter);

  const singleProjectView =
    !!state.activeProjectId && !showArchive && !showUpcoming && !showDueToday && !activeTag;

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (showArchive) {
      // Most recently completed first
      const aDone = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bDone = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bDone - aDone;
    }
    if (singleProjectView) {
      // Manual order wins; fall back to created date
      const pa = a.position ?? Number.MAX_SAFE_INTEGER;
      const pb = b.position ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    const order: Record<TaskStatus, number> = { 'in-progress': 0, todo: 1, done: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const pa = PRIORITY_RANK[a.priority ?? 'none'] ?? 3;
    const pb = PRIORITY_RANK[b.priority ?? 'none'] ?? 3;
    if (pa !== pb) return pa - pb;
    // Upcoming view: sort by due date ascending
    if (showUpcoming && a.dueDate && b.dueDate) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const todoCount = tagFilteredTasks.filter((t) => t.status === 'todo').length;
  const activeCount = tagFilteredTasks.filter((t) => t.status === 'in-progress').length;
  const doneCount = projectTasks.filter((t) => t.status === 'done').length;

  const parsedQuickAdd = newTaskTitle.trim() ? parseQuickAdd(newTaskTitle) : null;

  const handleAddTask = () => {
    const raw = newTaskTitle.trim();
    if (!raw) {
      setIsAdding(false);
      return;
    }
    const targetProject = state.activeProjectId || state.projects[0]?.id;
    if (!targetProject) {
      toastError(
        state.projects.length === 0
          ? 'Create a project first — tasks need a home.'
          : 'Pick a project from the sidebar before adding a task.'
      );
      return;
    }
    const parsed = parseQuickAdd(raw);
    const finalTitle = parsed.title || raw;
    const task: Task = {
      id: Date.now().toString(),
      title: finalTitle,
      status: 'todo',
      projectId: targetProject,
      startDate: todayStr,
      createdAt: new Date().toISOString(),
      ...(parsed.tags.length > 0 && { tags: parsed.tags }),
      ...(parsed.priority && { priority: parsed.priority }),
      ...(parsed.recurrence && { recurrence: parsed.recurrence }),
      ...(parsed.dueDate && { dueDate: parsed.dueDate }),
    };
    syncDispatch({ type: 'ADD_TASK', task });
    setNewTaskTitle('');
    inputRef.current?.focus();
  };

  const toggleBulkSelect = (taskId: string, e: React.MouseEvent) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      // Shift-click: range select within currently sortedTasks
      if (e.shiftKey && lastClickedIdRef.current && lastClickedIdRef.current !== taskId) {
        const ids = sortedTasks.map((t) => t.id);
        const a = ids.indexOf(lastClickedIdRef.current);
        const b = ids.indexOf(taskId);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(ids[i]);
          lastClickedIdRef.current = taskId;
          return next;
        }
      }
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      lastClickedIdRef.current = taskId;
      return next;
    });
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

  const priorityCounts = {
    high: statusFilteredTasks.filter((t) => t.priority === 'high').length,
    medium: statusFilteredTasks.filter((t) => t.priority === 'medium').length,
    low: statusFilteredTasks.filter((t) => t.priority === 'low').length,
  };

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  if (currentView === 'calendar') {
    return (
      <main id="main-content" className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden" tabIndex={-1}>
        <Suspense fallback={<div className="p-6 text-text-tertiary">Loading calendar…</div>}>
          <Calendar onMenuClick={onMenuClick} onSelectTask={onSelectTask} />
        </Suspense>
      </main>
    );
  }

  // Easter egg: show a black hole over the main content when the selected
  // task's due date precedes its start (or creation) date.
  const selectedTask = selectedTaskId
    ? state.tasks.find((t) => t.id === selectedTaskId)
    : null;
  const effectiveStart = selectedTask
    ? selectedTask.startDate ?? selectedTask.createdAt.slice(0, 10)
    : null;
  const showBlackHole = Boolean(
    easterEggsEnabled &&
      selectedTask &&
      selectedTask.dueDate &&
      effectiveStart &&
      startOfDay(new Date(selectedTask.dueDate)) < startOfDay(new Date(effectiveStart))
  );

  return (
    <main id="main-content" className="relative flex-1 flex flex-col min-w-0 bg-bg overflow-hidden" tabIndex={-1}>
      {showBlackHole && selectedTask && (
        <BlackHole
          startDate={effectiveStart!}
          dueDate={selectedTask.dueDate!}
        />
      )}
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
                  : showUpcoming
                    ? 'Upcoming'
                    : showArchive
                      ? 'Archive'
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
                  : showArchive
                    ? 'No completed tasks yet'
                    : showUpcoming
                      ? 'Nothing due in the next 7 days'
                      : showDueToday
                        ? 'Nothing due today'
                        : 'No tasks yet. Create one to get started.'
                : showArchive
                  ? `${tagFilteredTasks.length} completed`
                  : `${todoCount + activeCount} remaining`}
            </p>
          )}
        </div>
      </header>

      {currentView === 'dashboard' ? (
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-10">
          <div className="max-w-4xl">
            <Suspense
              fallback={<div className="py-10 text-center text-text-tertiary">Loading…</div>}
            >
              <Dashboard />
            </Suspense>
          </div>
        </div>
      ) : (
        <>
          {/* Filter banners */}
          {(activeTag || showDueToday || showUpcoming || showArchive) && (
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
              {showUpcoming && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-light text-accent text-[13px] font-medium">
                  <CalendarRange size={13} />
                  <span>Next 7 days</span>
                  <button
                    onClick={onClearUpcoming}
                    className="p-0.5 rounded-full hover:bg-accent/20 transition-base"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {showArchive && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-tertiary text-text-secondary text-[13px] font-medium">
                  <ArchiveIcon size={13} />
                  <span>Archive</span>
                  <button
                    onClick={onClearArchive}
                    className="p-0.5 rounded-full hover:bg-surface-hover transition-base"
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
          {!showArchive && (
            <div className="flex-shrink-0 px-4 sm:px-6 lg:px-10 pb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
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

                  <div className="flex items-center gap-1.5">
                    {(['high', 'medium', 'low'] as const).map((p) => {
                      const active = priorityFilter === p;
                      const style = PRIORITY_CHIP_STYLE[p];
                      const count = priorityCounts[p];
                      return (
                        <button
                          key={p}
                          onClick={() => setPriorityFilter(active ? 'all' : p)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] font-medium capitalize whitespace-nowrap transition-base ${
                            active ? style.active : style.idle
                          }`}
                          title={`Filter by ${p} priority`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white/90' : style.dot}`}
                          />
                          {p}
                          {count > 0 && (
                            <span className={`text-2xs ${active ? 'text-white/80' : 'opacity-70'}`}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {priorityFilter !== 'all' && (
                      <button
                        onClick={() => setPriorityFilter('all')}
                        className="p-1 rounded-full text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
                        aria-label="Clear priority filter"
                        title="Clear priority filter"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (state.projects.length === 0) {
                      toastError('Create a project first — tasks need a home.');
                      return;
                    }
                    setIsAdding(true);
                  }}
                  className="flex items-center gap-2 px-3.5 py-2 bg-accent text-text-inverse rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-base active:scale-[0.97] flex-shrink-0"
                  title={state.projects.length === 0 ? 'Create a project first' : undefined}
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Add task</span>
                </button>
              </div>
            </div>
          )}

          {/* Task list */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 pb-10">
            <div>
              {isAdding && (
                <div className="mb-3 animate-slide-down">
                  <div className="bg-surface border border-border-focus rounded-xl px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-border flex-shrink-0" />
                      <input
                        ref={inputRef}
                        type="text"
                        className="flex-1 bg-transparent text-[14px] text-text-primary outline-none"
                        placeholder="e.g. fix login bug tomorrow 3pm #frontend !high"
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
                    {parsedQuickAdd &&
                      (parsedQuickAdd.tags.length > 0 ||
                        parsedQuickAdd.priority ||
                        parsedQuickAdd.recurrence ||
                        parsedQuickAdd.dueDate) && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2 ml-8">
                          {parsedQuickAdd.dueDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-status-warning-bg text-status-warning text-2xs font-medium">
                              <CalendarDays size={11} />
                              {format(new Date(parsedQuickAdd.dueDate), 'MMM d')}
                              {parsedQuickAdd.hasTime && '*'}
                            </span>
                          )}
                          {parsedQuickAdd.priority && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-light text-accent text-2xs font-medium uppercase">
                              !{parsedQuickAdd.priority}
                            </span>
                          )}
                          {parsedQuickAdd.recurrence && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-tertiary text-text-secondary text-2xs font-medium">
                              ↻ {parsedQuickAdd.recurrence}
                            </span>
                          )}
                          {parsedQuickAdd.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent-light text-accent text-2xs font-medium"
                            >
                              #{t}
                            </span>
                          ))}
                          <span className="ml-auto text-2xs text-text-tertiary italic">
                            press Enter to save
                          </span>
                        </div>
                      )}
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
                                isMultiSelected={bulkSelected.has(task.id)}
                                onToggleMultiSelect={(e) => toggleBulkSelect(task.id, e)}
                                selectionActive={bulkSelected.size > 0}
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
                    {sortedTasks.map((task) => {
                      const canReorder = singleProjectView;
                      return (
                        <div
                          key={task.id}
                          draggable={canReorder}
                          onDragStart={
                            canReorder
                              ? (e) => {
                                  setDragTaskId(task.id);
                                  e.dataTransfer.effectAllowed = 'move';
                                }
                              : undefined
                          }
                          onDragOver={
                            canReorder
                              ? (e) => {
                                  e.preventDefault();
                                  e.dataTransfer.dropEffect = 'move';
                                  if (dragOverTaskId !== task.id) setDragOverTaskId(task.id);
                                }
                              : undefined
                          }
                          onDragLeave={
                            canReorder
                              ? () => {
                                  if (dragOverTaskId === task.id) setDragOverTaskId(null);
                                }
                              : undefined
                          }
                          onDrop={
                            canReorder
                              ? (e) => {
                                  e.preventDefault();
                                  if (!dragTaskId || dragTaskId === task.id) {
                                    setDragTaskId(null);
                                    setDragOverTaskId(null);
                                    return;
                                  }
                                  const ids = sortedTasks.map((t) => t.id);
                                  const from = ids.indexOf(dragTaskId);
                                  const to = ids.indexOf(task.id);
                                  if (from < 0 || to < 0) return;
                                  ids.splice(from, 1);
                                  ids.splice(to, 0, dragTaskId);
                                  syncDispatch({
                                    type: 'REORDER_TASKS',
                                    projectId: state.activeProjectId!,
                                    orderedIds: ids,
                                  });
                                  setDragTaskId(null);
                                  setDragOverTaskId(null);
                                }
                              : undefined
                          }
                          onDragEnd={
                            canReorder
                              ? () => {
                                  setDragTaskId(null);
                                  setDragOverTaskId(null);
                                }
                              : undefined
                          }
                          className={`${
                            dragOverTaskId === task.id && dragTaskId !== task.id
                              ? 'ring-2 ring-accent/40 rounded-xl'
                              : ''
                          } ${dragTaskId === task.id ? 'opacity-40' : ''}`}
                        >
                          <TaskItem
                            task={task}
                            isSelected={task.id === selectedTaskId}
                            onClick={() =>
                              onSelectTask(task.id === selectedTaskId ? null : task.id)
                            }
                            onTagClick={onTagClick}
                            isMultiSelected={bulkSelected.has(task.id)}
                            onToggleMultiSelect={(e) => toggleBulkSelect(task.id, e)}
                            selectionActive={bulkSelected.size > 0}
                          />
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  {filter !== 'all' ? (
                    <>
                      <ListFilter size={32} className="text-text-tertiary/40 mb-3" />
                      <p className="text-[14px] text-text-tertiary">
                        No {filter === 'in-progress' ? 'active' : 'pending'} tasks
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
      {bulkSelected.size > 0 && (
        <BulkActionBar selectedIds={bulkSelected} onClear={clearBulkSelection} />
      )}
    </main>
  );
};

export default MainContent;
