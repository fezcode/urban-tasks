import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useState,
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
    case 'REORDER_PROJECTS': {
      const indexOf = new Map(action.orderedIds.map((id, i) => [id, i]));
      const reordered = [...state.projects].sort(
        (a, b) => (indexOf.get(a.id) ?? 0) - (indexOf.get(b.id) ?? 0)
      );
      return {
        ...state,
        projects: reordered.map((p, i) => ({ ...p, position: i })),
      };
    }
    case 'REORDER_TASKS': {
      const indexOf = new Map(action.orderedIds.map((id, i) => [id, i]));
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.projectId === action.projectId && indexOf.has(t.id)
            ? { ...t, position: indexOf.get(t.id) }
            : t
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
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const AppStateContext = createContext<AppStateContextValue | undefined>(undefined);

export const AppStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const loaded = useRef(false);
  const { error: toastError, info: toastInfo } = useToast();
  const stateRef = useRef(state);
  stateRef.current = state;
  const isHistoryAction = useRef(false);
  const [undoStack, setUndoStack] = useState<Action[]>([]);
  const [redoStack, setRedoStack] = useState<Action[]>([]);

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
      // Track inverse for undo (only UPDATE_TASK, skips redo/undo-triggered dispatches)
      if (!isHistoryAction.current && action.type === 'UPDATE_TASK') {
        const prev = stateRef.current.tasks.find((t) => t.id === action.id);
        if (prev) {
          const inverseUpdates: Partial<typeof prev> = {};
          for (const key of Object.keys(action.updates) as (keyof typeof action.updates)[]) {
            (inverseUpdates as Record<string, unknown>)[key] = (prev as unknown as Record<string, unknown>)[
              key as string
            ];
          }
          setUndoStack((s) => [...s.slice(-49), { type: 'UPDATE_TASK', id: action.id, updates: inverseUpdates }]);
          setRedoStack([]);
        }
      }

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

          case 'REORDER_PROJECTS':
            await Promise.all(
              action.orderedIds.map((id, i) => api.projects.update(id, { position: i }))
            );
            break;

          case 'REORDER_TASKS':
            await Promise.all(
              action.orderedIds.map((id, i) => api.tasks.update(id, { position: i }))
            );
            break;

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

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      // Capture inverse-of-inverse for redo
      if (entry.type === 'UPDATE_TASK') {
        const current = stateRef.current.tasks.find((t) => t.id === entry.id);
        if (current) {
          const redoUpdates: Record<string, unknown> = {};
          for (const key of Object.keys(entry.updates)) {
            redoUpdates[key] = (current as unknown as Record<string, unknown>)[key];
          }
          setRedoStack((r) => [
            ...r.slice(-49),
            { type: 'UPDATE_TASK', id: entry.id, updates: redoUpdates as Partial<typeof current> },
          ]);
        }
      }
      isHistoryAction.current = true;
      syncDispatch(entry).finally(() => {
        isHistoryAction.current = false;
      });
      toastInfo('Undone');
      return stack.slice(0, -1);
    });
  }, [syncDispatch, toastInfo]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const entry = stack[stack.length - 1];
      if (entry.type === 'UPDATE_TASK') {
        const current = stateRef.current.tasks.find((t) => t.id === entry.id);
        if (current) {
          const undoUpdates: Record<string, unknown> = {};
          for (const key of Object.keys(entry.updates)) {
            undoUpdates[key] = (current as unknown as Record<string, unknown>)[key];
          }
          setUndoStack((u) => [
            ...u.slice(-49),
            { type: 'UPDATE_TASK', id: entry.id, updates: undoUpdates as Partial<typeof current> },
          ]);
        }
      }
      isHistoryAction.current = true;
      syncDispatch(entry).finally(() => {
        isHistoryAction.current = false;
      });
      toastInfo('Redone');
      return stack.slice(0, -1);
    });
  }, [syncDispatch, toastInfo]);

  return (
    <AppStateContext.Provider
      value={{
        state,
        dispatch,
        syncDispatch,
        reload,
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
};
