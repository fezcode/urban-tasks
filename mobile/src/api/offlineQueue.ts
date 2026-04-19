import { getItem, setItem } from '@/storage';

const KEY = 'urban_tasks_offline_queue_v1';

export interface QueuedOp {
  id: string;
  createdAt: number;
  kind:
    | 'updateTask'
    | 'deleteTask'
    | 'updateProject'
    | 'deleteProject'
    | 'updateMe';
  targetId?: string;
  payload?: any;
}

let memoryQueue: QueuedOp[] | null = null;

async function hydrate(): Promise<QueuedOp[]> {
  if (memoryQueue) return memoryQueue;
  const raw = await getItem(KEY);
  if (!raw) {
    memoryQueue = [];
    return memoryQueue;
  }
  try {
    const parsed = JSON.parse(raw);
    memoryQueue = Array.isArray(parsed) ? parsed : [];
  } catch {
    memoryQueue = [];
  }
  return memoryQueue;
}

async function persist() {
  if (!memoryQueue) return;
  await setItem(KEY, JSON.stringify(memoryQueue));
}

export async function enqueue(op: Omit<QueuedOp, 'id' | 'createdAt'>) {
  const q = await hydrate();
  const entry: QueuedOp = {
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  q.push(entry);
  await persist();
  return entry;
}

export async function queueSize(): Promise<number> {
  const q = await hydrate();
  return q.length;
}

export async function peekQueue(): Promise<QueuedOp[]> {
  return [...(await hydrate())];
}

export async function remove(id: string) {
  const q = await hydrate();
  const i = q.findIndex((o) => o.id === id);
  if (i >= 0) {
    q.splice(i, 1);
    await persist();
  }
}

export async function clearQueue() {
  memoryQueue = [];
  await persist();
}

const listeners = new Set<(n: number) => void>();
export function onQueueChange(cb: (n: number) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
export async function emitChange() {
  const n = (await hydrate()).length;
  listeners.forEach((cb) => cb(n));
}
