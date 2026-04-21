import type { Session } from './storage.js';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarSeed?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  position: number;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  body?: string | null;
  status: string;
  priority: string;
  tags: string[];
  startDate?: string | null;
  dueDate?: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  assigneeId?: string | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function createClient(apiUrl: string, token?: string) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${apiUrl}${path}`, { ...init, headers });
    const text = await res.text();
    const body = text ? (JSON.parse(text) as { data?: unknown; error?: string }) : null;
    if (!res.ok) {
      const msg = body?.error ? String(body.error) : res.statusText;
      throw new ApiError(res.status, msg);
    }
    return (body?.data ?? body) as T;
  }

  return {
    login: (email: string, password: string) =>
      request<AuthResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, name: string, password: string) =>
      request<AuthResponse>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, name, password }),
      }),
    me: () => request<User>('/api/v1/me'),
    listProjects: () => request<Project[]>('/api/v1/projects'),
    listTasks: (projectId?: string) =>
      request<Task[]>(`/api/v1/tasks${projectId ? `?projectId=${projectId}` : ''}`),
    createTask: (projectId: string, title: string) =>
      request<Task>('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({ projectId, title }),
      }),
    updateTask: (id: string, patch: Partial<{ status: string; title: string }>) =>
      request<Task>(`/api/v1/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    deleteTask: (id: string) =>
      request<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' }),
  };
}

export type Client = ReturnType<typeof createClient>;

export function clientFromSession(s: Session): Client {
  return createClient(s.apiUrl, s.accessToken);
}
