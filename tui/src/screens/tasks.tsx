import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Client, Project, Task } from '../api.js';

interface Props {
  client: Client;
  project: Project;
  onBack: () => void;
}

type Mode = 'list' | 'create';

const STATUS_ORDER = ['todo', 'inProgress', 'done'] as const;

function statusIcon(s: string): string {
  if (s === 'done') return '✔';
  if (s === 'inProgress') return '◐';
  return '○';
}

function priorityMark(p: string): string {
  if (p === 'high') return '!!';
  if (p === 'medium') return '!';
  return ' ';
}

export default function Tasks({ client, project, onBack }: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<Mode>('list');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    client
      .listTasks(project.id)
      .then((ts) => {
        const sorted = [...ts].sort((a, b) => {
          const sa = STATUS_ORDER.indexOf(a.status as (typeof STATUS_ORDER)[number]);
          const sb = STATUS_ORDER.indexOf(b.status as (typeof STATUS_ORDER)[number]);
          if (sa !== sb) return sa - sb;
          return a.position - b.position;
        });
        setTasks(sorted);
        setCursor((c) => Math.min(c, Math.max(0, sorted.length - 1)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [client, project.id]);

  useEffect(() => {
    load();
  }, [load]);

  useInput(async (input, key) => {
    if (mode === 'create' || busy || !tasks) return;
    if (key.escape || input === 'b') {
      onBack();
      return;
    }
    if (key.upArrow || input === 'k') {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setCursor((c) => Math.min(tasks.length - 1, c + 1));
      return;
    }
    if (input === 'n') {
      setDraft('');
      setMode('create');
      return;
    }
    if (input === 'r') {
      load();
      return;
    }
    const current = tasks[cursor];
    if (!current) return;

    if (input === ' ' || input === 'x') {
      const next = current.status === 'done' ? 'todo' : 'done';
      setBusy(true);
      try {
        await client.updateTask(current.id, { status: next });
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Update failed');
      } finally {
        setBusy(false);
      }
      return;
    }
    if (input === 'd') {
      setBusy(true);
      try {
        await client.deleteTask(current.id);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      } finally {
        setBusy(false);
      }
    }
  });

  const submitCreate = async () => {
    const title = draft.trim();
    if (!title) {
      setMode('list');
      return;
    }
    setBusy(true);
    try {
      await client.createTask(project.id, title);
      setDraft('');
      setMode('list');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>b: back</Text>
      </Box>
    );
  }
  if (!tasks) {
    return (
      <Box padding={1}>
        <Text color="yellow">
          <Spinner type="dots" /> Loading tasks…
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box>
        <Text bold color="cyan">
          {project.name}
        </Text>
        <Text dimColor> — {tasks.length} task{tasks.length === 1 ? '' : 's'}</Text>
      </Box>
      <Text dimColor>
        j/k: move · space: toggle done · n: new · d: delete · r: reload · b/esc: back
      </Text>
      <Box marginTop={1} flexDirection="column">
        {tasks.length === 0 && <Text dimColor>No tasks. Press n to create one.</Text>}
        {tasks.map((t, i) => {
          const selected = i === cursor;
          const done = t.status === 'done';
          return (
            <Box key={t.id}>
              <Text color={selected ? 'green' : undefined}>{selected ? '▶ ' : '  '}</Text>
              <Text color={done ? 'gray' : undefined}>
                {statusIcon(t.status)} {priorityMark(t.priority)}{' '}
              </Text>
              <Text
                color={done ? 'gray' : undefined}
                strikethrough={done}
              >
                {t.title}
              </Text>
              {t.dueDate && (
                <Text dimColor> · due {t.dueDate}</Text>
              )}
            </Box>
          );
        })}
      </Box>
      {mode === 'create' && (
        <Box marginTop={1}>
          <Text color="green">new: </Text>
          <TextInput
            value={draft}
            onChange={setDraft}
            onSubmit={submitCreate}
            focus
          />
        </Box>
      )}
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
