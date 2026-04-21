export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';
export type TaskRecurrence = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface TaskLink {
  id: string;
  title: string;
  url: string;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  body?: string;
  tags?: string[];
  links?: TaskLink[];
  subtasks?: Subtask[];
  startDate?: string;
  dueDate?: string;
  recurrence?: TaskRecurrence;
  status: TaskStatus;
  priority?: TaskPriority;
  projectId: string;
  position?: number;
  createdAt: string;
  completedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
  assigneeId?: string | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  iconSeed?: number;
  position?: number;
}

export interface AppState {
  tasks: Task[];
  projects: Project[];
  activeProjectId: string | null; // null = show all
}

export type Action =
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'UPDATE_TASK'; id: string; updates: Partial<Task> }
  | { type: 'DELETE_TASK'; id: string }
  | { type: 'ADD_PROJECT'; project: Project }
  | { type: 'RENAME_PROJECT'; id: string; name: string }
  | { type: 'DELETE_PROJECT'; id: string }
  | { type: 'SET_ACTIVE_PROJECT'; id: string | null }
  | { type: 'RANDOMIZE_PROJECT_STYLE'; id: string }
  | { type: 'REORDER_PROJECTS'; orderedIds: string[] }
  | { type: 'REORDER_TASKS'; projectId: string; orderedIds: string[] }
  | { type: 'SET_STATE'; state: AppState };
