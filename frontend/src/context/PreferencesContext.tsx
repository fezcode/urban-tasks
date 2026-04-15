import React, { createContext, useContext, useState, useEffect } from 'react';

interface Preferences {
  easterEggsEnabled: boolean;
}

interface PreferencesContextValue extends Preferences {
  setEasterEggsEnabled: (enabled: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const STORAGE_KEY = 'urban_tasks_prefs';

const defaults: Preferences = {
  easterEggsEnabled: true,
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

  return (
    <PreferencesContext.Provider value={{ ...prefs, setEasterEggsEnabled }}>
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
