const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

let accessToken: string | null = localStorage.getItem('access_token');
let refreshToken: string | null = localStorage.getItem('refresh_token');

let onAuthExpired: (() => void) | null = null;

export function setAuthExpiredHandler(handler: () => void) {
  onAuthExpired = handler;
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

export function hasTokens(): boolean {
  return accessToken !== null;
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;

    const json = await res.json();
    setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export function isPlanLimitError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 402;
}

export function friendlyErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (isPlanLimitError(err)) {
    return `${err.message} — upgrade to Pro to unlock.`;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // Token expired — try refresh once
  if (res.status === 401 && refreshToken) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    } else {
      clearTokens();
      onAuthExpired?.();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || `Request failed: ${res.status}`);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const json = await res.json();
  return json.data as T;
}

// --- Auth ---

export type Plan = 'free' | 'pro';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatarSeed?: string;
  plan?: Plan;
  effectivePlan?: Plan;
  trialEndsAt?: string | null;
  planUpdatedAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export function getMe(): Promise<UserProfile> {
  return request<UserProfile>('/me');
}

export function updateMe(patch: { name?: string; avatarSeed?: string | null }): Promise<UserProfile> {
  return request<UserProfile>('/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function deleteMe(): Promise<void> {
  await request<void>('/me', { method: 'DELETE' });
  clearTokens();
}

export async function register(
  email: string,
  name: string,
  password: string
): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, name, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

// --- Projects ---

import type {
  Project,
  Task,
  Location,
  PinboardBoard,
  PinboardCard,
  PinboardConnection,
  PinboardLinkedTask,
} from '../context/types';

export const projects = {
  list: () => request<Project[]>('/projects'),
  create: (data: { name: string; color: string; iconSeed?: number }) =>
    request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Project>) =>
    request<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
};

// --- Tasks ---

// --- Data export / import ---

export interface ExportData {
  version: number;
  exportedAt: string;
  projects: Project[];
  tasks: Task[];
}

export interface ImportResult {
  projectsCreated: number;
  tasksCreated: number;
}

export const data = {
  export: () => request<ExportData>('/data/export'),
  import: (payload: { projects: Project[]; tasks: Task[] }) =>
    request<ImportResult>('/data/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

// --- Members ---

export interface Member {
  projectId: string;
  userId: string;
  role: 'admin' | 'member';
  name: string;
  email: string;
  avatarSeed?: string;
  joinedAt: string;
}

export interface Invitation {
  id: string;
  projectId: string;
  projectName?: string;
  projectColor?: string;
  inviterId: string;
  inviterName?: string;
  inviteeEmail: string;
  inviteeId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
  respondedAt?: string;
}

export const members = {
  list: (projectId: string) => request<Member[]>(`/projects/${projectId}/members`),
  remove: (projectId: string, userId: string) =>
    request<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
  listInvitations: (projectId: string) =>
    request<Invitation[]>(`/projects/${projectId}/invitations`),
  invite: (projectId: string, email: string) =>
    request<Invitation>(`/projects/${projectId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
};

export const invitations = {
  listMine: () => request<Invitation[]>('/invitations'),
  accept: (id: string) =>
    request<Invitation>(`/invitations/${id}/accept`, { method: 'POST' }),
  reject: (id: string) =>
    request<Invitation>(`/invitations/${id}/reject`, { method: 'POST' }),
};

// --- Notifications ---

export interface Notification {
  id: string;
  userId: string;
  kind: string;
  payload: Record<string, any>;
  readAt?: string;
  createdAt: string;
}

export interface NotificationList {
  items: Notification[];
  unread: number;
}

export const notifications = {
  list: () => request<NotificationList>('/notifications'),
  markRead: (id: string) =>
    request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () =>
    request<void>('/notifications/read-all', { method: 'POST' }),
};

// --- Global search ---

export interface SearchTaskHit {
  id: string;
  title: string;
  snippet: string;
  projectId: string;
  projectName?: string;
  status: string;
  rank: number;
}

export interface SearchCommentHit {
  id: string;
  taskId: string;
  taskTitle: string;
  snippet: string;
  authorName?: string;
  projectId: string;
  projectName?: string;
  rank: number;
}

export interface SearchResult {
  tasks: SearchTaskHit[];
  comments: SearchCommentHit[];
}

export const search = {
  query: (q: string, limit = 20) =>
    request<SearchResult>(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
};

// --- Geocoding (OpenStreetMap proxy) ---

export const geocode = {
  search: (q: string) =>
    request<Location[]>(`/geocode/search?q=${encodeURIComponent(q)}`),
  reverse: (lat: number, lon: number) =>
    request<Location | null>(`/geocode/reverse?lat=${lat}&lon=${lon}`),
};

// --- Task comments ---

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  authorName?: string;
  authorAvatarSeed?: string | null;
  body: string;
  mentions: string[];
  editedAt?: string | null;
  createdAt: string;
}

export const comments = {
  list: (taskId: string) => request<TaskComment[]>(`/tasks/${taskId}/comments`),
  create: (taskId: string, body: string) =>
    request<TaskComment>(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  update: (id: string, body: string) =>
    request<TaskComment>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ body }),
    }),
  delete: (id: string) => request<void>(`/comments/${id}`, { method: 'DELETE' }),
};

// --- Saved filters ---

export interface SavedFilterDef {
  projectId?: string | null;
  tag?: string | null;
  dueRange?: 'today' | 'upcoming' | 'archive' | null;
  status?: 'all' | 'todo' | 'in-progress' | 'done';
  priority?: 'all' | 'high' | 'medium' | 'low';
}

export interface SavedFilter {
  id: string;
  name: string;
  icon?: string | null;
  filter: SavedFilterDef;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export const savedFilters = {
  list: () => request<SavedFilter[]>('/saved-filters'),
  create: (data: { name: string; icon?: string | null; filter: SavedFilterDef }) =>
    request<SavedFilter>('/saved-filters', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: { name?: string; icon?: string | null; filter?: SavedFilterDef; position?: number }
  ) =>
    request<SavedFilter>(`/saved-filters/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  delete: (id: string) => request<void>(`/saved-filters/${id}`, { method: 'DELETE' }),
};

// --- Pinboard (per-project corkboard) ---

export const pinboard = {
  get: (projectId: string) => request<PinboardBoard>(`/projects/${projectId}/pinboard`),
  pinCard: (projectId: string, taskId: string, x: number, y: number) =>
    request<PinboardCard>(`/projects/${projectId}/pinboard/cards`, {
      method: 'POST',
      body: JSON.stringify({ taskId, x, y }),
    }),
  moveCard: (cardId: string, x: number, y: number) =>
    request<PinboardCard>(`/pinboard/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ x, y }),
    }),
  recolorCard: (cardId: string, color: string) =>
    request<PinboardCard>(`/pinboard/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ color }),
    }),
  setBoardColor: (projectId: string, bgColor: string) =>
    request<{ bgColor: string | null }>(`/projects/${projectId}/pinboard`, {
      method: 'PATCH',
      body: JSON.stringify({ bgColor }),
    }),
  linkedTasks: (taskId: string) =>
    request<PinboardLinkedTask[]>(`/tasks/${taskId}/pinboard`),
  unpinCard: (cardId: string) =>
    request<void>(`/pinboard/cards/${cardId}`, { method: 'DELETE' }),
  connect: (projectId: string, fromTaskId: string, toTaskId: string, label = '') =>
    request<PinboardConnection>(`/projects/${projectId}/pinboard/connections`, {
      method: 'POST',
      body: JSON.stringify({ fromTaskId, toTaskId, label }),
    }),
  relabel: (connId: string, label: string) =>
    request<PinboardConnection>(`/pinboard/connections/${connId}`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    }),
  disconnect: (connId: string) =>
    request<void>(`/pinboard/connections/${connId}`, { method: 'DELETE' }),
};

export const tasks = {
  list: (projectId?: string) =>
    request<Task[]>(`/tasks${projectId ? `?projectId=${projectId}` : ''}`),
  get: (id: string) => request<Task>(`/tasks/${id}`),
  create: (data: {
    projectId: string;
    title: string;
    body?: string;
    tags?: string[];
    links?: { id: string; title: string; url: string }[];
    subtasks?: { id: string; title: string; done: boolean }[];
    recurrence?: string;
    startDate?: string;
    dueDate?: string;
    priority?: string;
    assigneeId?: string | null;
    location?: Location | null;
  }) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  bulk: (
    ids: string[],
    op: 'complete' | 'reopen' | 'delete' | 'set_priority' | 'move' | 'add_tags' | 'remove_tags',
    payload?: Record<string, unknown>
  ) =>
    request<{ updated: number; failed: { id: string; error: string }[] }>('/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids, op, payload }),
    }),
};
