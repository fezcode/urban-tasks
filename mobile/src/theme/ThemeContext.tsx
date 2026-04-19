import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { getItem, setItem } from '@/storage';
import {
  darkPalette,
  fontSize,
  lightPalette,
  Palette,
  radii,
  shadow,
  spacing,
  ThemeMode,
  typography,
} from './tokens';

interface ThemeValue {
  mode: ThemeMode;
  palette: Palette;
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
  fontSize: typeof fontSize;
  shadow: typeof shadow;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);
const STORAGE_KEY = 'urban_tasks_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    (async () => {
      const stored = await getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') setModeState(stored);
      else setModeState(Appearance.getColorScheme() === 'dark' ? 'dark' : 'light');
    })();
  }, []);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    setItem(STORAGE_KEY, m).catch(() => {});
  };

  const toggle = () => setMode(mode === 'light' ? 'dark' : 'light');

  const palette = mode === 'dark' ? darkPalette : lightPalette;

  return (
    <ThemeContext.Provider
      value={{ mode, palette, radii, spacing, typography, fontSize, shadow, toggle, setMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
