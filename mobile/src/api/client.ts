import Constants from 'expo-constants';
import { getItem, removeItem, setItem } from '@/storage';
import {
  enqueue,
  peekQueue,
  remove as removeFromQueue,
  emitChange,
  queueSize,
  onQueueChange,
  type QueuedOp,
} from '@/api/offlineQueue';

const DEFAULT_BASE = 'http://localhost:8080';
const BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  DEFAULT_BASE;

const ACCESS_KEY = 'urban_tasks_access';
const REFRESH_KEY = 'urban_tasks_refresh';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let hydrated = false;

async function hydrate() {
  if (hydrated) return;
  accessToken = await getItem(ACCESS_KEY);
  refreshToken = await getItem(REFRESH_KEY);
  hydrated = true;
}

export async function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  hydrated = true;
  await setItem(ACCESS_KEY, access);
  await setItem(REFRESH_KEY, refresh);
}

export async function getToken(): Promise<string | null> {
  await hydrate();
  return accessToken;
}

export async function clearToken() {
  accessToken = null;
  refreshToken = null;
  await removeItem(ACCESS_KEY);
  await removeItem(REFRESH_KEY);
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const json = await res.json();
    await setTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export class NetworkError extends Error {
  constructor() {
    super('Network unavailable');
    this.name = 'NetworkError';
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
  if (isPlanLimitError(err)) return `${err.message} — upgrade to Pro to unlock.`;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  await hydrate();
  const doFetch = () =>
    fetch(`${BASE_URL}/api/v1${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(init.headers ?? {}),
      },
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch {
    throw new NetworkError();
  }
  if (res.status === 401 && refreshToken) {
    if (await tryRefresh()) {
      try {
        res = await doFetch();
      } catch {
        throw new NetworkError();
      }
    } else {
      await clearToken();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as any);
    throw new ApiError(res.status, body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return (json.data ?? json) as T;
}

export type Plan = 'free' | 'pro';

export interface User {
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
  user: User;
}

export interface Location {
  name: string;
  lat: number;
  lon: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  body?: string;
  status: 'todo' | 'in-progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  startDate?: string;
  dueDate?: string;
  createdAt: string;
  assigneeId?: string | null;
  location?: Location | null;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
}

export interface PinboardCard {
  id: string;
  projectId: string;
  taskId: string;
  x: number;
  y: number;
  createdAt: string;
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
}

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

async function queueOnNetwork<T>(
  op: Omit<QueuedOp, 'id' | 'createdAt'>,
  fn: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof NetworkError) {
      await enqueue(op);
      await emitChange();
      return undefined;
    }
    throw err;
  }
}

export async function flushQueue(): Promise<{ flushed: number; failed: number }> {
  const ops = await peekQueue();
  let flushed = 0;
  let failed = 0;
  for (const op of ops) {
    try {
      if (op.kind === 'updateTask' && op.targetId) {
        await request<Task>(`/tasks/${op.targetId}`, {
          method: 'PATCH',
          body: JSON.stringify(op.payload),
        });
      } else if (op.kind === 'deleteTask' && op.targetId) {
        await request<void>(`/tasks/${op.targetId}`, { method: 'DELETE' });
      } else if (op.kind === 'updateProject' && op.targetId) {
        await request<Project>(`/projects/${op.targetId}`, {
          method: 'PATCH',
          body: JSON.stringify(op.payload),
        });
      } else if (op.kind === 'deleteProject' && op.targetId) {
        await request<void>(`/projects/${op.targetId}`, { method: 'DELETE' });
      } else if (op.kind === 'updateMe') {
        await request<User>('/me', {
          method: 'PATCH',
          body: JSON.stringify(op.payload),
        });
      }
      await removeFromQueue(op.id);
      flushed++;
    } catch (err) {
      if (err instanceof NetworkError) break;
      await removeFromQueue(op.id);
      failed++;
    }
  }
  await emitChange();
  return { flushed, failed };
}

export { queueSize, onQueueChange };

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, name: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, name, password }),
    }),
  me: () => request<User>('/me'),
  updateMe: (patch: { name?: string; avatarSeed?: string }) =>
    queueOnNetwork(
      { kind: 'updateMe', payload: patch },
      () => request<User>('/me', { method: 'PATCH', body: JSON.stringify(patch) }),
    ),
  deleteMe: () => request<void>('/me', { method: 'DELETE' }),
  listProjects: () => request<Project[]>('/projects'),
  createProject: (name: string, color: string) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
  updateProject: (id: string, patch: Partial<Project>) =>
    queueOnNetwork(
      { kind: 'updateProject', targetId: id, payload: patch },
      () =>
        request<Project>(`/projects/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
    ),
  deleteProject: (id: string) =>
    queueOnNetwork(
      { kind: 'deleteProject', targetId: id },
      () => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    ),
  listTasks: (projectId?: string) =>
    request<Task[]>(`/tasks${projectId ? `?projectId=${projectId}` : ''}`),
  createTask: (input: {
    projectId: string;
    title: string;
    body?: string;
    priority?: Task['priority'];
    assigneeId?: string | null;
    location?: Location | null;
  }) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (id: string, patch: Partial<Task>) =>
    queueOnNetwork(
      { kind: 'updateTask', targetId: id, payload: patch },
      () =>
        request<Task>(`/tasks/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }),
    ),
  deleteTask: (id: string) =>
    queueOnNetwork(
      { kind: 'deleteTask', targetId: id },
      () => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
    ),

  geocodeSearch: (q: string) =>
    request<Location[]>(`/geocode/search?q=${encodeURIComponent(q)}`),
  geocodeReverse: (lat: number, lon: number) =>
    request<Location | null>(`/geocode/reverse?lat=${lat}&lon=${lon}`),

  listMembers: (projectId: string) =>
    request<Member[]>(`/projects/${projectId}/members`),
  removeMember: (projectId: string, userId: string) =>
    request<void>(`/projects/${projectId}/members/${userId}`, { method: 'DELETE' }),
  listProjectInvitations: (projectId: string) =>
    request<Invitation[]>(`/projects/${projectId}/invitations`),
  invite: (projectId: string, email: string) =>
    request<Invitation>(`/projects/${projectId}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  listMyInvitations: () => request<Invitation[]>('/invitations'),
  acceptInvitation: (id: string) =>
    request<Invitation>(`/invitations/${id}/accept`, { method: 'POST' }),
  rejectInvitation: (id: string) =>
    request<Invitation>(`/invitations/${id}/reject`, { method: 'POST' }),

  listNotifications: () => request<NotificationList>('/notifications'),
  markNotificationRead: (id: string) =>
    request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request<void>('/notifications/read-all', { method: 'POST' }),

  // Pinboard (per-project corkboard)
  getPinboard: (projectId: string) =>
    request<PinboardBoard>(`/projects/${projectId}/pinboard`),
  pinCard: (projectId: string, taskId: string, x: number, y: number) =>
    request<PinboardCard>(`/projects/${projectId}/pinboard/cards`, {
      method: 'POST',
      body: JSON.stringify({ taskId, x, y }),
    }),
  movePinCard: (cardId: string, x: number, y: number) =>
    request<PinboardCard>(`/pinboard/cards/${cardId}`, {
      method: 'PATCH',
      body: JSON.stringify({ x, y }),
    }),
  unpinCard: (cardId: string) =>
    request<void>(`/pinboard/cards/${cardId}`, { method: 'DELETE' }),
  connectPins: (projectId: string, fromTaskId: string, toTaskId: string, label = '') =>
    request<PinboardConnection>(`/projects/${projectId}/pinboard/connections`, {
      method: 'POST',
      body: JSON.stringify({ fromTaskId, toTaskId, label }),
    }),
  relabelPin: (connId: string, label: string) =>
    request<PinboardConnection>(`/pinboard/connections/${connId}`, {
      method: 'PATCH',
      body: JSON.stringify({ label }),
    }),
  disconnectPin: (connId: string) =>
    request<void>(`/pinboard/connections/${connId}`, { method: 'DELETE' }),
};
