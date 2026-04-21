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

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskLink {
  id: string;
  title: string;
  url: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  body?: string | null;
  status: string;
  priority: string;
  tags: string[];
  links: TaskLink[];
  subtasks: Subtask[];
  startDate?: string | null;
  dueDate?: string | null;
  recurrence?: string | null;
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
    createProject: (name: string, color: string) =>
      request<Project>('/api/v1/projects', {
        method: 'POST',
        body: JSON.stringify({ name, color }),
      }),
    deleteProject: (id: string) =>
      request<void>(`/api/v1/projects/${id}`, { method: 'DELETE' }),
    listTasks: (projectId?: string) =>
      request<Task[]>(`/api/v1/tasks${projectId ? `?projectId=${projectId}` : ''}`),
    createTask: (
      payload: {
        projectId: string;
        title: string;
        body?: string;
        priority?: string;
        tags?: string[];
        dueDate?: string;
        startDate?: string;
        recurrence?: string;
      },
    ) =>
      request<Task>('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getTask: (id: string) => request<Task>(`/api/v1/tasks/${id}`),
    updateTask: (
      id: string,
      patch: Partial<{
        status: string;
        title: string;
        priority: string;
        tags: string[];
        subtasks: Subtask[];
        dueDate: string;
        startDate: string;
        recurrence: string;
        body: string;
        assigneeId: string;
      }>,
    ) =>
      request<Task>(`/api/v1/tasks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    deleteTask: (id: string) =>
      request<void>(`/api/v1/tasks/${id}`, { method: 'DELETE' }),

    listMembers: (projectId: string) =>
      request<ProjectMember[]>(`/api/v1/projects/${projectId}/members`),

    listInvitations: () => request<Invitation[]>('/api/v1/invitations'),
    acceptInvitation: (id: string) =>
      request<Invitation>(`/api/v1/invitations/${id}/accept`, { method: 'POST' }),
    rejectInvitation: (id: string) =>
      request<Invitation>(`/api/v1/invitations/${id}/reject`, { method: 'POST' }),
    listNotifications: () =>
      request<{ items: Notification[]; unread: number }>('/api/v1/notifications'),
    markNotificationRead: (id: string) =>
      request<void>(`/api/v1/notifications/${id}/read`, { method: 'POST' }),
    markAllNotificationsRead: () =>
      request<void>('/api/v1/notifications/read-all', { method: 'POST' }),
  };
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: string;
  name: string;
  email: string;
}

export interface Invitation {
  id: string;
  projectId: string;
  projectName?: string;
  projectColor?: string;
  inviterId: string;
  inviterName?: string;
  inviteeEmail: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  kind: string;
  payload?: Record<string, unknown> | null;
  readAt?: string | null;
  createdAt: string;
}

export type Client = ReturnType<typeof createClient>;

export function clientFromSession(s: Session): Client {
  return createClient(s.apiUrl, s.accessToken);
}
