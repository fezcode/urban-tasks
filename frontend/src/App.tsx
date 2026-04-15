import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppStateProvider, useAppState } from './context/AppState';
import { ToastProvider } from './context/ToastContext';
import { useDueReminders, requestNotificationPermission } from './hooks/useDueReminders';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import AuthPage from './components/AuthPage';
import type { View } from './components/Sidebar';

const TaskDetail = lazy(() => import('./components/TaskDetail'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const ShortcutsHelp = lazy(() => import('./components/ShortcutsHelp'));
const Onboarding = lazy(() => import('./components/Onboarding'));
const InstallPrompt = lazy(() => import('./components/InstallPrompt'));

const ONBOARDING_KEY = 'urban-tasks:onboarded';
const NOTIFICATIONS_ENABLED_KEY = 'urban-tasks:notifications-enabled';
const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;

const AuthenticatedApp: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('tasks');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showDueToday, setShowDueToday] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => notificationsSupported && !localStorage.getItem(ONBOARDING_KEY)
  );
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === 'true'
  );

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K always
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Undo / redo (Ctrl/Cmd+Z, Shift+Z or Ctrl/Cmd+Y)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        window.dispatchEvent(new Event(e.shiftKey ? 'urban-tasks:redo' : 'urban-tasks:undo'));
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        window.dispatchEvent(new Event('urban-tasks:redo'));
        return;
      }

      // Skip single-key shortcuts when typing in inputs
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n') {
        e.preventDefault();
        setCurrentView('tasks');
        window.dispatchEvent(new Event('urban-tasks:add'));
      } else if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen(true);
      } else if (e.key === 'Escape') {
        setSelectedTaskId(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const clearSpecials = useCallback(() => {
    setShowDueToday(false);
    setShowUpcoming(false);
    setShowArchive(false);
  }, []);

  const handleViewChange = useCallback(
    (view: View) => {
      setCurrentView(view);
      setActiveTag(null);
      clearSpecials();
    },
    [clearSpecials]
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      setActiveTag(tag);
      clearSpecials();
      setCurrentView('tasks');
    },
    [clearSpecials]
  );

  const handleDueTodayClick = useCallback(() => {
    clearSpecials();
    setShowDueToday(true);
    setActiveTag(null);
    setCurrentView('tasks');
  }, [clearSpecials]);

  const handleUpcomingClick = useCallback(() => {
    clearSpecials();
    setShowUpcoming(true);
    setActiveTag(null);
    setCurrentView('tasks');
  }, [clearSpecials]);

  const handleArchiveClick = useCallback(() => {
    clearSpecials();
    setShowArchive(true);
    setActiveTag(null);
    setCurrentView('tasks');
  }, [clearSpecials]);

  const handleCreateTask = useCallback(() => {
    setCurrentView('tasks');
    window.dispatchEvent(new Event('urban-tasks:add'));
  }, []);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShowOnboarding(false);
  }, []);

  const enableNotifications = useCallback(async () => {
    const perm = await requestNotificationPermission();
    if (perm === 'granted') {
      localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, 'true');
      setNotificationsEnabled(true);
    }
  }, []);

  return (
    <AppStateProvider>
      <RemindersWatcher enabled={notificationsEnabled} />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-accent focus:text-text-inverse focus:shadow-lg"
      >
        Skip to main content
      </a>
      <div className="flex h-screen bg-bg overflow-hidden">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-200 ease-out lg:static lg:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'
          }`}
        >
          <Sidebar
            currentView={currentView}
            onViewChange={handleViewChange}
            onNavigate={() => {
              if (window.innerWidth < 1024) setSidebarOpen(false);
            }}
            showDueToday={showDueToday}
            onDueTodayClick={handleDueTodayClick}
            showUpcoming={showUpcoming}
            onUpcomingClick={handleUpcomingClick}
            showArchive={showArchive}
            onArchiveClick={handleArchiveClick}
            activeTag={activeTag}
            onTagClick={handleTagClick}
          />
        </div>

        {/* Main content */}
        <MainContent
          currentView={currentView}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
          activeTag={activeTag}
          onTagClick={handleTagClick}
          onClearTag={() => setActiveTag(null)}
          showDueToday={showDueToday}
          onClearDueToday={() => setShowDueToday(false)}
          showUpcoming={showUpcoming}
          onClearUpcoming={() => setShowUpcoming(false)}
          showArchive={showArchive}
          onClearArchive={() => setShowArchive(false)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />

        {/* Task detail panel */}
        {(currentView === 'tasks' || currentView === 'calendar') && selectedTaskId && (
          <Suspense fallback={null}>
            <TaskDetail
              key={selectedTaskId}
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
              onTagClick={handleTagClick}
            />
          </Suspense>
        )}

        {/* Command palette */}
        {commandPaletteOpen && (
          <Suspense fallback={null}>
            <CommandPalette
              onClose={() => setCommandPaletteOpen(false)}
              onSelectTask={(id) => {
                setSelectedTaskId(id);
                setCurrentView('tasks');
              }}
              onCreateTask={handleCreateTask}
              onTagClick={handleTagClick}
              onViewChange={handleViewChange}
            />
          </Suspense>
        )}

        {/* Shortcuts help */}
        {shortcutsOpen && (
          <Suspense fallback={null}>
            <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <InstallPrompt />
        </Suspense>

        {/* First-run onboarding */}
        {showOnboarding && (
          <Suspense fallback={null}>
            <Onboarding
              onClose={dismissOnboarding}
              onEnableNotifications={async () => {
                await enableNotifications();
                dismissOnboarding();
              }}
              notificationsSupported={notificationsSupported}
            />
          </Suspense>
        )}
      </div>
    </AppStateProvider>
  );
};

const RemindersWatcher: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const { state, undo, redo } = useAppState();
  useDueReminders(state.tasks, enabled);

  useEffect(() => {
    const onUndo = () => undo();
    const onRedo = () => redo();
    window.addEventListener('urban-tasks:undo', onUndo);
    window.addEventListener('urban-tasks:redo', onRedo);
    return () => {
      window.removeEventListener('urban-tasks:undo', onUndo);
      window.removeEventListener('urban-tasks:redo', onRedo);
    };
  }, [undo, redo]);

  return null;
};

const AppShell: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <AuthenticatedApp /> : <AuthPage />;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <PreferencesProvider>
        <ToastProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ToastProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
};

export default App;
