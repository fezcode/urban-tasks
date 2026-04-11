import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type { AppState, Action } from './types';

const PROJECT_COLORS = ['#C96442', '#7C6B58', '#5B8A72', '#8B7EC8', '#C9A042', '#C95E6E', '#4A8CB8'];

export const getNextColor = (projects: AppState['projects']): string => {
  const used = new Set(projects.map((p) => p.color));
  return PROJECT_COLORS.find((c) => !used.has(c)) || PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
};

const initialState: AppState = {
  tasks: [],
  projects: [
    { id: 'personal', name: 'Personal', color: '#C96442' },
  ],
  activeProjectId: null,
};

const STORAGE_KEY = 'urban_tasks_v3';

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, ...action.updates } : t
        ),
      };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.project] };
    case 'RENAME_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p
        ),
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        tasks: state.tasks.filter((t) => t.projectId !== action.id),
        activeProjectId:
          state.activeProjectId === action.id ? null : state.activeProjectId,
      };
    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.id };
    case 'SET_STATE':
      return action.state;
    default:
      return state;
  }
};

const AppStateContext = createContext<
  { state: AppState; dispatch: React.Dispatch<Action> } | undefined
>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialized = useRef(false);
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: 'SET_STATE', state: parsed });
      } catch (e) {
        console.error('Failed to load state', e);
      }
    }
    initialized.current = true;
  }, []);

  // Save to localStorage on every change after init
  useEffect(() => {
    if (initialized.current) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  return (
    <AppStateContext.Provider value={{ state, dispatch }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
};
