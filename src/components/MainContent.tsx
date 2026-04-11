import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppState';
import TaskItem from './TaskItem';
import Dashboard from './Dashboard';
import { Plus, CheckCircle2, ListFilter } from 'lucide-react';
import type { Task, TaskStatus } from '../context/types';
import type { View } from './Sidebar';

type Filter = 'all' | 'todo' | 'in-progress' | 'done';

interface Props {
  currentView: View;
}

const MainContent: React.FC<Props> = ({ currentView }) => {
  const { state, dispatch } = useAppState();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) inputRef.current?.focus();
  }, [isAdding]);

  const activeProject = state.activeProjectId
    ? state.projects.find((p) => p.id === state.activeProjectId)
    : null;

  const projectTasks = state.activeProjectId
    ? state.tasks.filter((t) => t.projectId === state.activeProjectId)
    : state.tasks;

  const filteredTasks =
    filter === 'all' ? projectTasks : projectTasks.filter((t) => t.status === filter);

  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const order: Record<TaskStatus, number> = { 'in-progress': 0, todo: 1, done: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const todoCount = projectTasks.filter((t) => t.status === 'todo').length;
  const activeCount = projectTasks.filter((t) => t.status === 'in-progress').length;
  const doneCount = projectTasks.filter((t) => t.status === 'done').length;

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

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: projectTasks.length },
    { key: 'todo', label: 'To do', count: todoCount },
    { key: 'in-progress', label: 'Active', count: activeCount },
    { key: 'done', label: 'Done', count: doneCount },
  ];

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-bg overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-10 pt-10 pb-6">
        <div className="max-w-4xl">
          <div className="flex items-center gap-3 mb-1">
            {activeProject && (
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: activeProject.color }}
              />
            )}
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              {currentView === 'dashboard'
                ? activeProject
                  ? `${activeProject.name} — Dashboard`
                  : 'Dashboard'
                : activeProject
                  ? activeProject.name
                  : 'All Tasks'}
            </h1>
          </div>
          {currentView === 'tasks' && (
            <p className="text-[13px] text-text-tertiary mt-1">
              {projectTasks.length === 0
                ? 'No tasks yet. Create one to get started.'
                : `${todoCount + activeCount} remaining · ${doneCount} completed`}
            </p>
          )}
        </div>
      </header>

      {currentView === 'dashboard' ? (
        <div className="flex-1 overflow-y-auto px-10 pb-10">
          <div className="max-w-4xl">
            <Dashboard />
          </div>
        </div>
      ) : (
        <>
          {/* Filters + Add button */}
          <div className="flex-shrink-0 px-10 pb-4">
            <div className="max-w-4xl flex items-center justify-between">
              <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-1">
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-1.5 rounded-md text-[13px] transition-base ${
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
                className="flex items-center gap-2 px-3.5 py-2 bg-accent text-text-inverse rounded-lg text-[13px] font-medium hover:bg-accent-hover transition-base active:scale-[0.97]"
              >
                <Plus size={16} />
                Add task
              </button>
            </div>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto px-10 pb-10">
            <div className="max-w-4xl">
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
                <div className="space-y-1">
                  {sortedTasks.map((task) => (
                    <TaskItem key={task.id} task={task} showProject={!state.activeProjectId} />
                  ))}
                </div>
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
                        Click "Add task" to create your first task
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
