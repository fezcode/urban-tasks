export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high';
export type TaskRecurrence = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface TaskLink {
  id: string;
  title: string;
  url: string;
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
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
  location?: Location | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  iconSeed?: number;
  position?: number;
}

// --- Pinboard (per-project corkboard) ---

export interface PinboardCard {
  id: string;
  projectId: string;
  taskId: string;
  x: number;
  y: number;
  color?: string | null;
  createdAt: string;
}

export interface PinboardLinkedTask {
  connectionId: string;
  label: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface PinboardConnection {
  id: string;
  projectId: string;
  aTaskId: string;
  bTaskId: string;
  label: string;
  createdAt: string;
}

export interface PinboardBoard {
  cards: PinboardCard[];
  connections: PinboardConnection[];
  bgColor?: string | null;
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
