import Constants from 'expo-constants';
import { getItem, removeItem, setItem } from '@/storage';

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

  let res = await doFetch();
  if (res.status === 401 && refreshToken) {
    if (await tryRefresh()) {
      res = await doFetch();
    } else {
      await clearToken();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as any);
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return (json.data ?? json) as T;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarSeed?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  body?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  startDate?: string;
  dueDate?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
}

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
  listProjects: () => request<Project[]>('/projects'),
  createProject: (name: string, color: string) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify({ name, color }),
    }),
  listTasks: (projectId?: string) =>
    request<Task[]>(`/tasks${projectId ? `?projectId=${projectId}` : ''}`),
  createTask: (input: {
    projectId: string;
    title: string;
    body?: string;
    priority?: Task['priority'];
  }) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(input) }),
  updateTask: (id: string, patch: Partial<Task>) =>
    request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
};
