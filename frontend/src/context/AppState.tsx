import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import type { AppState, Action } from './types';
import * as api from '../api/client';
import { useToast } from './ToastContext';

const PROJECT_COLORS = [
  '#C96442',
  '#7C6B58',
  '#5B8A72',
  '#8B7EC8',
  '#C9A042',
  '#C95E6E',
  '#4A8CB8',
];

export const getNextColor = (projects: AppState['projects']): string => {
  const used = new Set(projects.map((p) => p.color));
  return (
    PROJECT_COLORS.find((c) => !used.has(c)) ||
    PROJECT_COLORS[projects.length % PROJECT_COLORS.length]
  );
};

const initialState: AppState = {
  tasks: [],
  projects: [],
  activeProjectId: null,
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.updates } : t)),
      };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };
    case 'ADD_PROJECT':
      return { ...state, projects: [...state.projects, action.project] };
    case 'RENAME_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.id ? { ...p, name: action.name } : p)),
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        tasks: state.tasks.filter((t) => t.projectId !== action.id),
        activeProjectId: state.activeProjectId === action.id ? null : state.activeProjectId,
      };
    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProjectId: action.id };
    case 'RANDOMIZE_PROJECT_STYLE': {
      const current = state.projects.find((p) => p.id === action.id);
      const available = PROJECT_COLORS.filter((c) => c !== current?.color);
      const newColor = available[Math.floor(Math.random() * available.length)];
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id
            ? { ...p, color: newColor, iconSeed: Math.floor(Math.random() * 10000) }
            : p
        ),
      };
    }
    case 'SET_STATE':
      return action.state;
    default:
      return state;
  }
};

interface AppStateContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  syncDispatch: (action: Action) => Promise<void>;
  reload: () => Promise<void>;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const loaded = useRef(false);
  const { error: toastError } = useToast();

  const reload = useCallback(async () => {
    try {
      const [tasks, projects] = await Promise.all([api.tasks.list(), api.projects.list()]);
      dispatch({
        type: 'SET_STATE',
        state: { tasks: tasks || [], projects: projects || [], activeProjectId: null },
      });
    } catch (e) {
      console.error('Failed to load data from API', e);
    }
  }, []);

  // Load from API on mount
  useEffect(() => {
    if (!loaded.current && api.hasTokens()) {
      loaded.current = true;
      reload();
    }
  }, [reload]);

  // Dispatch that also syncs to the API — fire-and-forget with local optimistic update
  const syncDispatch = useCallback(
    async (action: Action) => {
      // Optimistic local update first
      dispatch(action);

      try {
        switch (action.type) {
          case 'ADD_TASK':
            await api.tasks.create({
              projectId: action.task.projectId,
              title: action.task.title,
              body: action.task.body,
              tags: action.task.tags,
              links: action.task.links,
              subtasks: action.task.subtasks,
              dueDate: action.task.dueDate,
              priority: action.task.priority,
            });
            // Reload to get server-assigned ID
            await reload();
            break;

          case 'UPDATE_TASK':
            await api.tasks.update(action.id, action.updates);
            break;

          case 'DELETE_TASK':
            await api.tasks.delete(action.id);
            break;

          case 'ADD_PROJECT':
            await api.projects.create({
              name: action.project.name,
              color: action.project.color,
              iconSeed: action.project.iconSeed,
            });
            await reload();
            break;

          case 'RENAME_PROJECT':
            await api.projects.update(action.id, { name: action.name });
            break;

          case 'DELETE_PROJECT':
            await api.projects.delete(action.id);
            break;

          case 'RANDOMIZE_PROJECT_STYLE': {
            // Get the updated project from local state after dispatch
            // We need to read the new values — but dispatch is async in React
            // So we compute them here the same way the reducer does
            const current = state.projects.find((p) => p.id === action.id);
            const available = PROJECT_COLORS.filter((c) => c !== current?.color);
            const newColor = available[Math.floor(Math.random() * available.length)];
            const newSeed = Math.floor(Math.random() * 10000);
            await api.projects.update(action.id, { color: newColor, iconSeed: newSeed });
            break;
          }

          // SET_ACTIVE_PROJECT and SET_STATE are local-only
        }
      } catch (e) {
        console.error('API sync failed, reloading', e);
        toastError('Change could not be saved — reverting.');
        await reload();
      }
    },
    [reload, state.projects, toastError]
  );

  return (
    <AppStateContext.Provider value={{ state, dispatch, syncDispatch, reload }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
};
