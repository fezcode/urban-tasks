import React, { createContext, useContext, useState, useEffect } from 'react';

interface Preferences {
  easterEggsEnabled: boolean;
  showToday: boolean;
  showUpcoming: boolean;
  showArchive: boolean;
}

interface PreferencesContextValue extends Preferences {
  setEasterEggsEnabled: (enabled: boolean) => void;
  setShowToday: (enabled: boolean) => void;
  setShowUpcoming: (enabled: boolean) => void;
  setShowArchive: (enabled: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const STORAGE_KEY = 'urban_tasks_prefs';

const defaults: Preferences = {
  easterEggsEnabled: true,
  showToday: true,
  showUpcoming: true,
  showArchive: true,
};

function load(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [prefs, setPrefs] = useState<Preferences>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const setEasterEggsEnabled = (enabled: boolean) =>
    setPrefs((p) => ({ ...p, easterEggsEnabled: enabled }));
  const setShowToday = (enabled: boolean) => setPrefs((p) => ({ ...p, showToday: enabled }));
  const setShowUpcoming = (enabled: boolean) => setPrefs((p) => ({ ...p, showUpcoming: enabled }));
  const setShowArchive = (enabled: boolean) => setPrefs((p) => ({ ...p, showArchive: enabled }));

  return (
    <PreferencesContext.Provider
      value={{
        ...prefs,
        setEasterEggsEnabled,
        setShowToday,
        setShowUpcoming,
        setShowArchive,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
};
