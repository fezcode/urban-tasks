import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Client, ProjectMember, Subtask, Task } from '../api.js';
import { Markdown } from '../markdown.js';

interface Props {
  client: Client;
  taskId: string;
  onBack: (changed: boolean) => void;
  onEdit: (task: Task) => void;
}

function priorityColor(p: string): string | undefined {
  if (p === 'high') return 'red';
  if (p === 'medium') return 'yellow';
  if (p === 'low') return 'blue';
  return undefined;
}

function statusLabel(s: string): string {
  if (s === 'done') return '✔ done';
  if (s === 'in-progress') return '◐ in progress';
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

function makeSubtaskId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function TaskDetail({ client, taskId, onBack, onEdit }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0); // subtask index
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [picker, setPicker] = useState<{ members: ProjectMember[]; cursor: number } | null>(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  const load = () =>
    client
      .getTask(taskId)
      .then(setTask)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const saveSubtasks = async (nextSubs: Subtask[]) => {
    if (!task) return;
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
  };

  const openPicker = async () => {
    if (!task) return;
    setPickerLoading(true);
    try {
      const members = await client.listMembers(task.projectId);
      setPicker({ members, cursor: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setPickerLoading(false);
    }
  };

  useInput(async (input, key) => {
    if (picker) {
      if (key.escape) {
        setPicker(null);
        return;
      }
      if (key.upArrow || input === 'k') {
        setPicker((p) => p && { ...p, cursor: Math.max(0, p.cursor - 1) });
        return;
      }
      if (key.downArrow || input === 'j') {
        setPicker(
          (p) => p && { ...p, cursor: Math.min(p.members.length, p.cursor + 1) },
        );
        return;
      }
      if (key.return && task) {
        const isUnassign = picker.cursor === picker.members.length;
        const nextId = isUnassign ? '' : picker.members[picker.cursor]?.userId ?? '';
        setPicker(null);
        setBusy(true);
        try {
          const updated = await client.updateTask(task.id, { assigneeId: nextId });
          setTask(updated);
          setChanged(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Assign failed');
        } finally {
          setBusy(false);
        }
      }
      return;
    }
    if (adding || busy || !task) return;
    if (input === 'q') process.exit(0);
    if (key.escape || input === 'b') {
      onBack(changed);
      return;
    }
    if (input === 'r') {
      load();
      return;
    }
    if (input === 'e') {
      onEdit(task);
      return;
    }
    if (input === 'a') {
      setDraft('');
      setAdding(true);
      return;
    }
    if (input === '@') {
      await openPicker();
      return;
    }
    const setStatus = async (next: string) => {
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
    };

    if (input === ' ' || input === 'x') {
      await setStatus(task.status === 'done' ? 'todo' : 'done');
      return;
    }
    if (input === 'i') {
      await setStatus(task.status === 'in-progress' ? 'todo' : 'in-progress');
      return;
    }
    if (input === 's') {
      const order = ['todo', 'in-progress', 'done'];
      const next = order[(order.indexOf(task.status) + 1) % order.length] ?? 'todo';
      await setStatus(next);
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
        await saveSubtasks(
          task.subtasks.map((s) => (s.id === current.id ? { ...s, done: !s.done } : s)),
        );
        return;
      }
      if (input === 'D') {
        const current = task.subtasks[cursor];
        if (!current) return;
        await saveSubtasks(task.subtasks.filter((s) => s.id !== current.id));
        return;
      }
    }
  });

  useInput((_input, key) => {
    if (!adding) return;
    if (key.escape) {
      setAdding(false);
      setDraft('');
    }
  });

  const submitNewSubtask = async () => {
    const title = draft.trim();
    if (!title || !task) {
      setAdding(false);
      return;
    }
    const next: Subtask[] = [
      ...task.subtasks,
      { id: makeSubtaskId(), title, done: false },
    ];
    setAdding(false);
    setDraft('');
    await saveSubtasks(next);
  };

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

  const statusColor =
    task.status === 'done' ? 'green' : task.status === 'in-progress' ? 'yellow' : undefined;

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        flexDirection="column"
      >
        <Text bold color="cyan">
          {task.title}
        </Text>
        <Box marginTop={1}>
          <Text color={statusColor}>{statusLabel(task.status)}</Text>
          <Text dimColor>  │  </Text>
          <Text color={priorityColor(task.priority)}>priority: {task.priority}</Text>
          <Text dimColor>  │  </Text>
          <Text>due: {formatDate(task.dueDate)}</Text>
          {task.recurrence && (
            <>
              <Text dimColor>  │  </Text>
              <Text dimColor>↻ {task.recurrence}</Text>
            </>
          )}
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
        {task.location && (
          <Box flexDirection="column" marginTop={1}>
            <Text>📍 {task.location.name}</Text>
            <Text dimColor>
              https://www.openstreetmap.org/?mlat={task.location.lat}&mlon={task.location.lon}#map=16/
              {task.location.lat}/{task.location.lon}
            </Text>
          </Box>
        )}
      </Box>

      {task.body && (
        <Box
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          marginTop={1}
          flexDirection="column"
        >
          <Text bold dimColor>
            Description
          </Text>
          <Markdown source={task.body} />
        </Box>
      )}

      {task.links.length > 0 && (
        <Box
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          marginTop={1}
          flexDirection="column"
        >
          <Text bold dimColor>
            Links
          </Text>
          {task.links.map((l) => (
            <Text key={l.id}>
              • {l.title || l.url} <Text dimColor>({l.url})</Text>
            </Text>
          ))}
        </Box>
      )}

      <Box
        borderStyle="round"
        borderColor="magenta"
        paddingX={1}
        marginTop={1}
        flexDirection="column"
      >
        <Text bold color="magenta">
          Subtasks{' '}
          <Text dimColor>
            ({doneCount}/{task.subtasks.length})
          </Text>
        </Text>
        {task.subtasks.length === 0 && !adding && (
          <Text dimColor>No subtasks. Press a to add.</Text>
        )}
        {task.subtasks.map((s, i) => {
          const selected = i === cursor && !adding;
          return (
            <Box key={s.id}>
              <Text color={selected ? 'green' : undefined}>{selected ? '▶ ' : '  '}</Text>
              <Text color={s.done ? 'gray' : undefined} strikethrough={s.done}>
                {s.done ? '✔' : '○'} {s.title}
              </Text>
            </Box>
          );
        })}
        {adding && (
          <Box>
            <Text color="green">+ </Text>
            <TextInput
              value={draft}
              onChange={setDraft}
              onSubmit={submitNewSubtask}
              focus
              placeholder="subtask title (Enter to add, Esc cancels)"
            />
          </Box>
        )}
      </Box>

      {picker && (
        <Box
          borderStyle="round"
          borderColor="cyan"
          paddingX={1}
          marginTop={1}
          flexDirection="column"
        >
          <Text bold color="cyan">
            Assign to…
          </Text>
          <Text dimColor>j/k: move · Enter: select · Esc: cancel</Text>
          {picker.members.map((m, i) => {
            const selected = i === picker.cursor;
            const current = task.assigneeId === m.userId;
            return (
              <Box key={m.userId}>
                <Text color={selected ? 'green' : undefined}>{selected ? '▶ ' : '  '}</Text>
                <Text>
                  {m.name} <Text dimColor>({m.email})</Text>
                </Text>
                {current && <Text color="cyan"> · current</Text>}
              </Box>
            );
          })}
          <Box>
            <Text color={picker.cursor === picker.members.length ? 'green' : undefined}>
              {picker.cursor === picker.members.length ? '▶ ' : '  '}
            </Text>
            <Text dimColor>(unassign)</Text>
          </Box>
        </Box>
      )}

      <Box marginTop={1} paddingX={1}>
        <Text dimColor>
          space: done · i: in-progress · s: cycle · e: edit · a: add subtask · @: assign ·{' '}
          {task.subtasks.length > 0 ? 'j/k: move · t: toggle · D: delete subtask · ' : ''}
          r: reload · b/esc: back
        </Text>
      </Box>
      {busy && (
        <Box paddingX={1}>
          <Text color="yellow">
            <Spinner type="dots" /> working…
          </Text>
        </Box>
      )}
    </Box>
  );
}
