import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AppStateProvider } from './context/AppState';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import type { View } from './components/Sidebar';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('tasks');

  return (
    <ThemeProvider>
      <AppStateProvider>
        <div className="flex h-screen bg-bg overflow-hidden">
          <Sidebar currentView={currentView} onViewChange={setCurrentView} />
          <MainContent currentView={currentView} />
        </div>
      </AppStateProvider>
    </ThemeProvider>
  );
};

export default App;
