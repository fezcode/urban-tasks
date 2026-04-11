import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppState';
import { getNextColor } from '../context/AppState';
import { useTheme } from '../context/ThemeContext';
import {
  Inbox,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  FolderOpen,
  Sun,
  Moon,
  LayoutDashboard,
  ListTodo,
} from 'lucide-react';
import ProjectIcon from './ProjectIcon';

export type View = 'tasks' | 'dashboard';

interface Props {
  currentView: View;
  onViewChange: (view: View) => void;
}

const Sidebar: React.FC<Props> = ({ currentView, onViewChange }) => {
  const { state, dispatch } = useAppState();
  const { theme, toggle: toggleTheme } = useTheme();
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const createInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCreating) createInputRef.current?.focus();
  }, [isCreating]);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      setIsCreating(false);
      return;
    }
    const project = {
      id: Date.now().toString(),
      name,
      color: getNextColor(state.projects),
    };
    dispatch({ type: 'ADD_PROJECT', project });
    dispatch({ type: 'SET_ACTIVE_PROJECT', id: project.id });
    setNewName('');
    setIsCreating(false);
  };

  const handleRename = (id: string) => {
    const name = editName.trim();
    if (name) {
      dispatch({ type: 'RENAME_PROJECT', id, name });
    }
    setEditingId(null);
    setEditName('');
  };

  const handleDelete = (id: string) => {
    dispatch({ type: 'DELETE_PROJECT', id });
    setMenuOpenId(null);
  };

  const totalTasks = state.tasks.filter((t) => t.status !== 'done').length;

  return (
    <aside className="w-64 flex-shrink-0 bg-bg-secondary border-r border-border-light flex flex-col h-full select-none">
      {/* Logo */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 4.5A2.5 2.5 0 0 1 4.5 2h3a2.5 2.5 0 0 1 0 5h-3A2.5 2.5 0 0 1 2 4.5Z"
                fill="white"
                fillOpacity="0.9"
              />
              <path
                d="M6 11.5A2.5 2.5 0 0 1 8.5 9h3a2.5 2.5 0 0 1 0 5h-3A2.5 2.5 0 0 1 6 11.5Z"
                fill="white"
                fillOpacity="0.5"
              />
            </svg>
          </div>
          <span className="font-semibold text-[15px] text-text-primary tracking-tight">
            Urban Tasks
          </span>
        </div>
      </div>

      {/* View toggle */}
      <div className="px-3 mt-4 space-y-0.5">
        <button
          onClick={() => onViewChange('tasks')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
            currentView === 'tasks'
              ? 'bg-surface text-text-primary shadow-sm font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          <ListTodo size={18} className={currentView === 'tasks' ? 'text-accent' : ''} />
          <span>Tasks</span>
          {totalTasks > 0 && (
            <span className="ml-auto text-2xs text-text-tertiary tabular-nums">{totalTasks}</span>
          )}
        </button>
        <button
          onClick={() => onViewChange('dashboard')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
            currentView === 'dashboard'
              ? 'bg-surface text-text-primary shadow-sm font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          <LayoutDashboard size={18} className={currentView === 'dashboard' ? 'text-accent' : ''} />
          <span>Dashboard</span>
        </button>
      </div>

      {/* Divider */}
      <div className="mx-5 my-3 border-t border-border-light" />

      {/* All Tasks filter */}
      <div className="px-3">
        <button
          onClick={() => dispatch({ type: 'SET_ACTIVE_PROJECT', id: null })}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
            state.activeProjectId === null
              ? 'bg-surface text-text-primary shadow-sm font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          <Inbox size={18} className={state.activeProjectId === null ? 'text-accent' : ''} />
          <span>All Projects</span>
        </button>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto px-3 mt-3">
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Projects
          </span>
          <button
            onClick={() => setIsCreating(true)}
            className="p-0.5 rounded text-text-tertiary hover:text-accent transition-base"
            title="New project"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-0.5">
          {state.projects.map((project) => {
            const count = state.tasks.filter(
              (t) => t.projectId === project.id && t.status !== 'done'
            ).length;

            if (editingId === project.id) {
              return (
                <div key={project.id} className="flex items-center gap-2 px-2 py-1">
                  <ProjectIcon projectId={project.id} color={project.color} size={20} />
                  <input
                    ref={editInputRef}
                    type="text"
                    className="flex-1 bg-surface border border-border rounded px-2 py-1 text-[13px] text-text-primary outline-none focus:border-accent"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(project.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleRename(project.id)}
                  />
                </div>
              );
            }

            return (
              <div key={project.id} className="relative group">
                <button
                  onClick={() => dispatch({ type: 'SET_ACTIVE_PROJECT', id: project.id })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
                    state.activeProjectId === project.id
                      ? 'bg-surface text-text-primary shadow-sm font-medium'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  <ProjectIcon projectId={project.id} color={project.color} size={22} />
                  <span className="truncate">{project.name}</span>
                  {count > 0 && (
                    <span className="ml-auto text-2xs text-text-tertiary tabular-nums">
                      {count}
                    </span>
                  )}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === project.id ? null : project.id);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-bg-tertiary transition-base"
                >
                  <MoreHorizontal size={14} className="text-text-tertiary" />
                </button>

                {menuOpenId === project.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-1 z-50 w-40 bg-surface border border-border rounded-lg shadow-lg py-1 animate-fade-in"
                  >
                    <button
                      onClick={() => {
                        setEditingId(project.id);
                        setEditName(project.name);
                        setMenuOpenId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-secondary transition-base"
                    >
                      <Pencil size={13} />
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-danger hover:bg-danger-bg transition-base"
                    >
                      <Trash2 size={13} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {isCreating && (
            <div className="flex items-center gap-2 px-2 py-1 animate-fade-in">
              <FolderOpen size={16} className="text-text-tertiary flex-shrink-0" />
              <input
                ref={createInputRef}
                type="text"
                className="flex-1 bg-surface border border-border rounded px-2 py-1 text-[13px] text-text-primary outline-none focus:border-accent"
                placeholder="Project name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') {
                    setIsCreating(false);
                    setNewName('');
                  }
                }}
                onBlur={handleCreate}
              />
            </div>
          )}

          {state.projects.length === 0 && !isCreating && (
            <p className="px-3 py-4 text-[13px] text-text-tertiary text-center">No projects yet</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-light flex items-center justify-between">
        <div className="flex items-center gap-2 text-2xs text-text-tertiary">
          <div className="w-1.5 h-1.5 rounded-full bg-status-active" />
          <span>{state.tasks.length} tasks</span>
        </div>
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
