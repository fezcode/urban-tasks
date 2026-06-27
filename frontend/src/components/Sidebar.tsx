import React, { useState, useRef, useEffect, useMemo, Suspense, lazy } from 'react';
import { useAppState } from '../context/AppState';
import { getNextColor } from '../context/AppState';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Logo from './Logo';
import Avatar from './Avatar';
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
  X,
  CalendarDays,
  Tag,
  Sparkles,
  CalendarRange,
  Archive,
  Download,
  Upload,
  LogOut,
  UserCog,
  Mail,
  Users,
  Filter as FilterIcon,
  Settings,
  Pin,
} from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';
import ProjectIcon from './ProjectIcon';
import ConfirmDialog from './ConfirmDialog';
import * as api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useInbox } from '../hooks/useInbox';
import { useSavedFilters } from '../hooks/useSavedFilters';
import { usePreferences } from '../context/PreferencesContext';
import SavedFiltersModal from './SavedFiltersModal';

const ProfilePage = lazy(() => import('./ProfilePage'));

export type View = 'tasks' | 'dashboard' | 'calendar' | 'pinboard';

interface Props {
  currentView: View;
  onViewChange: (view: View) => void;
  onNavigate?: () => void;
  showDueToday?: boolean;
  onDueTodayClick?: () => void;
  showUpcoming?: boolean;
  onUpcomingClick?: () => void;
  showArchive?: boolean;
  onArchiveClick?: () => void;
  activeTag?: string | null;
  onTagClick?: (tag: string) => void;
  onInboxClick?: () => void;
  onMembersClick?: (projectId: string) => void;
}

const Sidebar: React.FC<Props> = ({
  currentView,
  onViewChange,
  onNavigate,
  showDueToday,
  onDueTodayClick,
  showUpcoming,
  onUpcomingClick,
  showArchive,
  onArchiveClick,
  activeTag,
  onTagClick,
  onInboxClick,
  onMembersClick,
}) => {
  const { state, dispatch, syncDispatch, reload } = useAppState();
  const { showToday, showUpcoming: prefUpcoming, showArchive: prefArchive } = usePreferences();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleProjectDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const ids = state.projects.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    syncDispatch({ type: 'REORDER_PROJECTS', orderedIds: ids });
    setDragId(null);
    setDragOverId(null);
  };
  const { success, error: toastError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, toggle: toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileMenuOpen]);
  const { badge: inboxBadge } = useInbox();
  const { items: savedFilters, refresh: refreshSavedFilters } = useSavedFilters();
  const [savedFiltersModalOpen, setSavedFiltersModalOpen] = useState(false);

  const applySavedFilter = (def: api.SavedFilterDef) => {
    dispatch({ type: 'SET_ACTIVE_PROJECT', id: def.projectId ?? null });
    window.dispatchEvent(
      new CustomEvent('urban-tasks:apply-saved-filter', { detail: def })
    );
    onNavigate?.();
  };
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
    syncDispatch({ type: 'ADD_PROJECT', project });
    dispatch({ type: 'SET_ACTIVE_PROJECT', id: project.id });
    setNewName('');
    setIsCreating(false);
    onNavigate?.();
  };

  const handleRename = (id: string) => {
    const name = editName.trim();
    if (name) {
      syncDispatch({ type: 'RENAME_PROJECT', id, name });
    }
    setEditingId(null);
    setEditName('');
  };

  const requestDelete = (id: string) => {
    setConfirmDeleteId(id);
    setMenuOpenId(null);
  };

  const handleExport = async () => {
    try {
      const payload = await api.data.export();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urban-tasks-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      success('Data exported successfully');
    } catch (e) {
      console.error('Export failed', e);
      toastError('Export failed. Please try again.');
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!Array.isArray(payload.projects) || !Array.isArray(payload.tasks)) {
        throw new Error('Invalid file format');
      }
      const result = await api.data.import({
        projects: payload.projects,
        tasks: payload.tasks,
      });
      await reload();
      success(`Imported ${result.projectsCreated} projects and ${result.tasksCreated} tasks.`);
    } catch (err) {
      console.error('Import failed', err);
      toastError('Import failed: ' + (err instanceof Error ? err.message : 'unknown error'));
    }
  };

  const confirmDelete = () => {
    if (confirmDeleteId) {
      syncDispatch({ type: 'DELETE_PROJECT', id: confirmDeleteId });
    }
    setConfirmDeleteId(null);
  };

  const handleRandomize = (id: string) => {
    syncDispatch({ type: 'RANDOMIZE_PROJECT_STYLE', id });
    setMenuOpenId(null);
  };

  const totalTasks = state.tasks.filter((t) => t.status !== 'done').length;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dueTodayCount = state.tasks.filter(
    (t) => t.dueDate === todayStr && t.status !== 'done'
  ).length;

  const today = startOfDay(new Date());
  const upcomingCount = state.tasks.filter((t) => {
    if (!t.dueDate || t.status === 'done') return false;
    const diff = differenceInDays(startOfDay(new Date(t.dueDate)), today);
    return diff >= 0 && diff <= 7;
  }).length;

  const archiveCount = state.tasks.filter((t) => t.status === 'done').length;

  // Build tag map: tag → count (non-done tasks)
  const tagMap = useMemo(() => {
    const map = new Map<string, number>();
    state.tasks.forEach((t) => t.tags?.forEach((tag) => map.set(tag, (map.get(tag) || 0) + 1)));
    return map;
  }, [state.tasks]);

  const isTasksActive = currentView === 'tasks' && !showDueToday && !showUpcoming && !showArchive;

  return (
    <aside className="w-full flex-shrink-0 bg-bg-secondary border-r border-border-light flex flex-col h-full select-none" aria-label="Primary navigation">
      {/* Logo */}
      <div className="px-5 pt-6 pb-2">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-semibold text-[15px] text-text-primary tracking-tight">
            Urban Tasks
          </span>
          <button
            onClick={onNavigate}
            className="ml-auto p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover lg:hidden transition-base"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="px-3 mt-4 space-y-0.5">
        <button
          onClick={() => {
            onViewChange('tasks');
            onNavigate?.();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
            isTasksActive
              ? 'bg-surface text-text-primary shadow-sm font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          <ListTodo size={18} className={isTasksActive ? 'text-accent' : ''} />
          <span>Tasks</span>
          {totalTasks > 0 && (
            <span className="ml-auto text-2xs text-text-tertiary tabular-nums">{totalTasks}</span>
          )}
        </button>
        <button
          onClick={() => {
            onViewChange('dashboard');
            onNavigate?.();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
            currentView === 'dashboard'
              ? 'bg-surface text-text-primary shadow-sm font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          <LayoutDashboard size={18} className={currentView === 'dashboard' ? 'text-accent' : ''} />
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => {
            onViewChange('calendar');
            onNavigate?.();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
            currentView === 'calendar'
              ? 'bg-surface text-text-primary shadow-sm font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          <CalendarRange size={18} className={currentView === 'calendar' ? 'text-accent' : ''} />
          <span>Calendar</span>
        </button>
        <button
          onClick={() => {
            onViewChange('pinboard');
            onNavigate?.();
          }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
            currentView === 'pinboard'
              ? 'bg-surface text-text-primary shadow-sm font-medium'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
          }`}
        >
          <Pin size={18} className={currentView === 'pinboard' ? 'text-accent' : ''} />
          <span>Pinboard</span>
        </button>
        {showToday && (
          <button
            onClick={() => {
              onDueTodayClick?.();
              onNavigate?.();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
              showDueToday
                ? 'bg-surface text-text-primary shadow-sm font-medium'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <CalendarDays size={18} className={showDueToday ? 'text-accent' : ''} />
            <span>Today</span>
            {dueTodayCount > 0 && (
              <span
                className={`ml-auto text-2xs tabular-nums ${showDueToday ? 'text-accent font-medium' : 'text-text-tertiary'}`}
              >
                {dueTodayCount}
              </span>
            )}
          </button>
        )}
        {prefUpcoming && (
          <button
            onClick={() => {
              onUpcomingClick?.();
              onNavigate?.();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
              showUpcoming
                ? 'bg-surface text-text-primary shadow-sm font-medium'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <CalendarRange size={18} className={showUpcoming ? 'text-accent' : ''} />
            <span>Upcoming</span>
            {upcomingCount > 0 && (
              <span
                className={`ml-auto text-2xs tabular-nums ${showUpcoming ? 'text-accent font-medium' : 'text-text-tertiary'}`}
              >
                {upcomingCount}
              </span>
            )}
          </button>
        )}
        {prefArchive && (
          <button
            onClick={() => {
              onArchiveClick?.();
              onNavigate?.();
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
              showArchive
                ? 'bg-surface text-text-primary shadow-sm font-medium'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <Archive size={18} className={showArchive ? 'text-accent' : ''} />
            <span>Archive</span>
            {archiveCount > 0 && (
              <span className="ml-auto text-2xs text-text-tertiary tabular-nums">{archiveCount}</span>
            )}
          </button>
        )}
        <button
          onClick={() => {
            onInboxClick?.();
            onNavigate?.();
          }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-base relative"
        >
          <Mail size={18} />
          <span>Inbox</span>
          {inboxBadge > 0 && (
            <span className="ml-auto text-[10px] font-semibold text-text-inverse bg-accent rounded-full px-1.5 py-0.5 tabular-nums min-w-[18px] text-center">
              {inboxBadge > 99 ? '99+' : inboxBadge}
            </span>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="mx-5 my-3 border-t border-border-light" />

      {/* All Tasks filter */}
      <div className="px-3">
        <button
          onClick={() => {
            dispatch({ type: 'SET_ACTIVE_PROJECT', id: null });
            onNavigate?.();
          }}
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

      {/* Scrollable: Projects + Tags */}
      <div className="flex-1 overflow-y-auto px-3 mt-3">
        {/* Projects */}
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
                  <ProjectIcon
                    projectId={project.id}
                    color={project.color}
                    iconSeed={project.iconSeed}
                    size={20}
                  />
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
              <div
                key={project.id}
                className={`relative group ${
                  dragOverId === project.id && dragId !== project.id
                    ? 'ring-2 ring-accent/40 rounded-lg'
                    : ''
                } ${dragId === project.id ? 'opacity-40' : ''}`}
                draggable
                onDragStart={(e) => {
                  setDragId(project.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverId !== project.id) setDragOverId(project.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === project.id) setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleProjectDrop(project.id);
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDragOverId(null);
                }}>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_ACTIVE_PROJECT', id: project.id });
                    onNavigate?.();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[14px] transition-base ${
                    state.activeProjectId === project.id
                      ? 'bg-surface text-text-primary shadow-sm font-medium'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  <ProjectIcon
                    projectId={project.id}
                    color={project.color}
                    iconSeed={project.iconSeed}
                    size={22}
                  />
                  <span className="truncate">{project.name}</span>
                  {count > 0 && (
                    <span
                      className={`ml-auto text-2xs text-text-tertiary tabular-nums transition-opacity ${
                        menuOpenId === project.id
                          ? 'opacity-0'
                          : 'group-hover:opacity-0'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpenId(menuOpenId === project.id ? null : project.id);
                  }}
                  aria-label={`Project options for ${project.name}`}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-base hover:bg-bg-tertiary ${
                    menuOpenId === project.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <MoreHorizontal size={14} className="text-text-tertiary" />
                </button>

                {menuOpenId === project.id && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-full mt-1 z-50 w-44 bg-surface border border-border rounded-lg shadow-lg py-1 animate-fade-in"
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
                      onClick={() => handleRandomize(project.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-secondary transition-base"
                    >
                      <Sparkles size={13} />
                      Shuffle Style
                    </button>
                    <button
                      onClick={() => {
                        onMembersClick?.(project.id);
                        setMenuOpenId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-secondary transition-base"
                    >
                      <Users size={13} />
                      Members
                    </button>
                    <button
                      onClick={() => requestDelete(project.id)}
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

        {/* Smart lists section */}
        <div className="mx-2 my-3 border-t border-border-light" />
        <div className="flex items-center justify-between px-3 mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            Smart lists
          </span>
          <button
            onClick={() => setSavedFiltersModalOpen(true)}
            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
            title="Manage smart lists"
            aria-label="Manage smart lists"
          >
            <Settings size={12} />
          </button>
        </div>
        {savedFilters.length > 0 ? (
          <div className="space-y-0.5 mb-2">
            {savedFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => applySavedFilter(f.filter)}
                className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-base"
                title={f.name}
              >
                <FilterIcon size={14} className="text-text-tertiary flex-shrink-0" />
                <span className="truncate">{f.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setSavedFiltersModalOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-base mb-2"
          >
            <Plus size={12} />
            New smart list
          </button>
        )}

        {/* Tags section */}
        {tagMap.size > 0 && (
          <>
            <div className="mx-2 my-3 border-t border-border-light" />
            <div className="px-3 mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                Tags
              </span>
            </div>
            <div className="space-y-0.5">
              {Array.from(tagMap.entries()).map(([tag, count]) => (
                <button
                  key={tag}
                  onClick={() => {
                    onTagClick?.(tag);
                    onNavigate?.();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] transition-base ${
                    activeTag === tag
                      ? 'bg-accent-light text-accent font-medium'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  <Tag
                    size={14}
                    className={activeTag === tag ? 'text-accent' : 'text-text-tertiary'}
                  />
                  <span className="truncate">@{tag}</span>
                  <span className="ml-auto text-2xs text-text-tertiary tabular-nums">{count}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Profile */}
      {user && (
        <div className="px-3 pt-3 border-t border-border-light relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen((v) => !v)}
            aria-expanded={profileMenuOpen}
            aria-haspopup="menu"
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-base ${
              profileMenuOpen
                ? 'bg-surface-hover'
                : 'hover:bg-surface-hover'
            }`}
          >
            <Avatar
              seed={user.avatarSeed ?? user.id}
              name={user.name}
              size={32}
              className="flex-shrink-0 rounded-full"
            />
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[13px] font-medium text-text-primary truncate flex items-center gap-1.5">
                <span className="truncate">{user.name || 'Unnamed'}</span>
                <PlanBadge user={user} />
              </div>
              <div className="text-2xs text-text-tertiary truncate">{user.email}</div>
            </div>
            <MoreHorizontal size={14} className="text-text-tertiary flex-shrink-0" />
          </button>

          {profileMenuOpen && (
            <div
              role="menu"
              className="absolute bottom-full left-3 right-3 mb-1 z-50 bg-surface border border-border rounded-lg shadow-lg py-1 animate-fade-in"
            >
              <button
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setProfileOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-text-primary hover:bg-surface-hover transition-base"
              >
                <UserCog size={14} className="text-text-tertiary" />
                Edit profile
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setProfileMenuOpen(false);
                  setConfirmLogout(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-text-primary hover:bg-surface-hover transition-base"
              >
                <LogOut size={14} className="text-text-tertiary" />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-2xs text-text-tertiary">
          <div className="w-1.5 h-1.5 rounded-full bg-status-active" />
          <span>{state.tasks.length} tasks</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleExport}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
            title="Export data as JSON"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleImportClick}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
            title="Import data from JSON"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      {confirmDeleteId &&
        (() => {
          const p = state.projects.find((pr) => pr.id === confirmDeleteId);
          const taskCount = state.tasks.filter((t) => t.projectId === confirmDeleteId).length;
          return (
            <ConfirmDialog
              title={`Delete "${p?.name ?? 'project'}"?`}
              message={
                taskCount > 0
                  ? `This will permanently delete the project and all ${taskCount} of its tasks. This cannot be undone.`
                  : 'This will permanently delete the project. This cannot be undone.'
              }
              confirmLabel="Delete"
              danger
              onConfirm={confirmDelete}
              onCancel={() => setConfirmDeleteId(null)}
            />
          );
        })()}

      {confirmLogout && (
        <ConfirmDialog
          title="Sign out?"
          message="You'll need to sign in again to access your tasks. Your data is safe on the server."
          confirmLabel="Sign out"
          onConfirm={() => {
            setConfirmLogout(false);
            logout();
          }}
          onCancel={() => setConfirmLogout(false)}
        />
      )}

      {profileOpen && (
        <Suspense fallback={null}>
          <ProfilePage onClose={() => setProfileOpen(false)} />
        </Suspense>
      )}

      {savedFiltersModalOpen && (
        <SavedFiltersModal
          items={savedFilters}
          onClose={() => setSavedFiltersModalOpen(false)}
          onChanged={() => void refreshSavedFilters()}
        />
      )}

    </aside>
  );
};

function PlanBadge({ user }: { user: { plan?: string; effectivePlan?: string; trialEndsAt?: string | null } }) {
  const effective = user.effectivePlan ?? user.plan;
  if (!effective) return null;
  if (effective === 'pro' && user.plan === 'free' && user.trialEndsAt) {
    const days = Math.max(
      0,
      Math.ceil((new Date(user.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    return (
      <span
        title={`Pro trial — ${days} day${days === 1 ? '' : 's'} left`}
        className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400"
      >
        Trial · {days}d
      </span>
    );
  }
  if (effective === 'pro') {
    return (
      <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
        Pro
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-hover text-text-tertiary">
      Free
    </span>
  );
}

export default Sidebar;
