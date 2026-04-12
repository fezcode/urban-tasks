import React, { useState, useEffect, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AppStateProvider } from './context/AppState';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import TaskDetail from './components/TaskDetail';
import CommandPalette from './components/CommandPalette';
import type { View } from './components/Sidebar';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('tasks');
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  // Ctrl+K / Cmd+K to open command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleTagClick = useCallback((tag: string) => {
    setActiveTag(tag);
    setCurrentView('tasks');
  }, []);

  const handleCreateTask = useCallback(() => {
    setCurrentView('tasks');
    window.dispatchEvent(new Event('urban-tasks:add'));
  }, []);

  return (
    <ThemeProvider>
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
              onViewChange={setCurrentView}
              onNavigate={() => {
                if (window.innerWidth < 1024) setSidebarOpen(false);
              }}
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
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          />

          {/* Task detail panel */}
          {currentView === 'tasks' && selectedTaskId && (
            <TaskDetail
              key={selectedTaskId}
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
              onTagClick={handleTagClick}
            />
          )}

          {/* Command palette — conditionally mounted to reset state each open */}
          {commandPaletteOpen && (
            <CommandPalette
              onClose={() => setCommandPaletteOpen(false)}
              onSelectTask={(id) => {
                setSelectedTaskId(id);
                setCurrentView('tasks');
              }}
              onCreateTask={handleCreateTask}
              onTagClick={handleTagClick}
              onViewChange={setCurrentView}
            />
          )}
        </div>
      </AppStateProvider>
    </ThemeProvider>
  );
};

export default App;
