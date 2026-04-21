import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { Client, Subtask, Task } from '../api.js';

interface Props {
  client: Client;
  taskId: string;
  onBack: (changed: boolean) => void;
}

function priorityColor(p: string): string | undefined {
  if (p === 'high') return 'red';
  if (p === 'medium') return 'yellow';
  if (p === 'low') return 'blue';
  return undefined;
}

function statusLabel(s: string): string {
  if (s === 'done') return '✔ done';
  if (s === 'inProgress') return '◐ in progress';
  return '○ todo';
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  // dates come as YYYY-MM-DD or ISO timestamp
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

export default function TaskDetail({ client, taskId, onBack }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0); // subtask index
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);

  const load = () =>
    client
      .getTask(taskId)
      .then(setTask)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  useInput(async (input, key) => {
    if (busy || !task) return;
    if (key.escape || input === 'b') {
      onBack(changed);
      return;
    }
    if (input === 'r') {
      load();
      return;
    }
    if (input === ' ' || input === 'x') {
      const next = task.status === 'done' ? 'todo' : 'done';
      setBusy(true);
      try {
        const updated = await client.updateTask(task.id, { status: next });
        setTask(updated);
        setChanged(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Update failed');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (task.subtasks.length > 0) {
      if (key.upArrow || input === 'k') {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.downArrow || input === 'j') {
        setCursor((c) => Math.min(task.subtasks.length - 1, c + 1));
        return;
      }
      if (input === 't') {
        const current = task.subtasks[cursor];
        if (!current) return;
        const nextSubs: Subtask[] = task.subtasks.map((s) =>
          s.id === current.id ? { ...s, done: !s.done } : s,
        );
        setBusy(true);
        try {
          const updated = await client.updateTask(task.id, { subtasks: nextSubs });
          setTask(updated);
          setChanged(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Subtask update failed');
        } finally {
          setBusy(false);
        }
      }
    }
  });

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>b/esc: back</Text>
      </Box>
    );
  }

  if (!task) {
    return (
      <Box padding={1}>
        <Text color="yellow">
          <Spinner type="dots" /> Loading task…
        </Text>
      </Box>
    );
  }

  const doneCount = task.subtasks.filter((s) => s.done).length;

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text bold color="cyan">
          {task.title}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>{statusLabel(task.status)}  </Text>
        <Text color={priorityColor(task.priority)}>priority: {task.priority}</Text>
        <Text>  due: {formatDate(task.dueDate)}</Text>
        {task.recurrence && <Text dimColor>  ↻ {task.recurrence}</Text>}
      </Box>
      {task.startDate && (
        <Box>
          <Text dimColor>start: {formatDate(task.startDate)}</Text>
        </Box>
      )}
      {task.tags.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>tags: </Text>
          <Text>{task.tags.map((t) => `#${t}`).join(' ')}</Text>
        </Box>
      )}
      {task.assigneeId && (
        <Box>
          <Text dimColor>assignee: {task.assigneeId}</Text>
        </Box>
      )}
      {task.body && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>── description ──</Text>
          <Text>{task.body}</Text>
        </Box>
      )}
      {task.links.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>── links ──</Text>
          {task.links.map((l) => (
            <Text key={l.id}>
              • {l.title || l.url} <Text dimColor>({l.url})</Text>
            </Text>
          ))}
        </Box>
      )}
      {task.subtasks.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            ── subtasks ({doneCount}/{task.subtasks.length}) ──
          </Text>
          {task.subtasks.map((s, i) => {
            const selected = i === cursor;
            return (
              <Box key={s.id}>
                <Text color={selected ? 'green' : undefined}>{selected ? '▶ ' : '  '}</Text>
                <Text color={s.done ? 'gray' : undefined} strikethrough={s.done}>
                  {s.done ? '✔' : '○'} {s.title}
                </Text>
              </Box>
            );
          })}
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>
          space: toggle · {task.subtasks.length > 0 ? 'j/k: subtask · t: toggle subtask · ' : ''}
          r: reload · b/esc: back
        </Text>
      </Box>
      {busy && (
        <Box marginTop={1}>
          <Text color="yellow">
            <Spinner type="dots" /> working…
          </Text>
        </Box>
      )}
    </Box>
  );
}
