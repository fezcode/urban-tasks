import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppStateProvider } from './context/AppState';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import AuthPage from './components/AuthPage';
import type { View } from './components/Sidebar';

const TaskDetail = lazy(() => import('./components/TaskDetail'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const ShortcutsHelp = lazy(() => import('./components/ShortcutsHelp'));

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

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K always
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
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

  return (
    <AppStateProvider>
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
        {currentView === 'tasks' && selectedTaskId && (
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
      </div>
    </AppStateProvider>
  );
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
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
