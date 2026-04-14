import { useEffect, useRef } from 'react';
import { startOfDay, differenceInDays } from 'date-fns';
import type { Task } from '../context/types';

const STORAGE_KEY = 'urban-tasks:notified';
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

type NotifiedMap = Record<string, string>;

function readNotified(): NotifiedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NotifiedMap) : {};
  } catch {
    return {};
  }
}

function writeNotified(map: NotifiedMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

function notifyTask(task: Task, label: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  new Notification(label, {
    body: task.title,
    tag: `task-${task.id}`,
    icon: '/favicon.svg',
  });
}

export const useDueReminders = (tasks: Task[], enabled: boolean) => {
  const tasksRef = useRef<Task[]>(tasks);
  tasksRef.current = tasks;

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;

    const check = () => {
      const today = startOfDay(new Date()).toISOString().slice(0, 10);
      const notified = readNotified();
      let changed = false;

      for (const t of tasksRef.current) {
        if (!t.dueDate || t.status === 'done') continue;
        const due = startOfDay(new Date(t.dueDate));
        const diff = differenceInDays(due, startOfDay(new Date()));
        const key = `${t.id}:${today}`;
        if (notified[key]) continue;

        if (diff === 0) {
          notifyTask(t, 'Due today');
          notified[key] = 'today';
          changed = true;
        } else if (diff < 0) {
          notifyTask(t, `${Math.abs(diff)}d overdue`);
          notified[key] = 'overdue';
          changed = true;
        }
      }

      // Prune old entries (>30 days)
      for (const key of Object.keys(notified)) {
        const dateStr = key.split(':')[1];
        if (!dateStr) continue;
        const age = differenceInDays(startOfDay(new Date()), startOfDay(new Date(dateStr)));
        if (age > 30) {
          delete notified[key];
          changed = true;
        }
      }

      if (changed) writeNotified(notified);
    };

    check();
    const id = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  return await Notification.requestPermission();
};
