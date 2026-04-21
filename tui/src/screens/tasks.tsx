import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Client, Project, Task } from '../api.js';

interface Props {
  client: Client;
  project: Project;
  onBack: () => void;
  onOpenTask: (task: Task) => void;
  onCreate: () => void;
  onEdit: (task: Task) => void;
  onSwitchProject: (dir: 1 | -1) => void;
}

const STATUS_ORDER = ['todo', 'in-progress', 'done'] as const;

type StatusFilter = 'all' | 'todo' | 'in-progress' | 'done' | 'open';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

const STATUS_FILTERS: StatusFilter[] = ['all', 'open', 'todo', 'in-progress', 'done'];
const PRIORITY_FILTERS: PriorityFilter[] = ['all', 'high', 'medium', 'low'];

function statusIcon(s: string): string {
  if (s === 'done') return '✔';
  if (s === 'in-progress') return '◐';
  return '○';
}

function priorityMark(p: string): string {
  if (p === 'high') return '!!';
  if (p === 'medium') return '!';
  return ' ';
}

function cycle<T>(list: readonly T[], current: T, dir: 1 | -1): T {
  const i = list.indexOf(current);
  return list[(i + dir + list.length) % list.length] ?? list[0]!;
}

export default function Tasks({
  client,
  project,
  onBack,
  onOpenTask,
  onCreate,
  onEdit,
  onSwitchProject,
}: Props) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');

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
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [client, project.id]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (!tasks) return [] as Task[];
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter === 'open' && t.status === 'done') return false;
      if (statusFilter !== 'all' && statusFilter !== 'open' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (q) {
        const hay = `${t.title} ${t.body ?? ''} ${t.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, query]);

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, visible.length - 1)));
  }, [visible.length]);

  useInput(async (input, key) => {
    if (busy || !tasks || searching) return;
    if (key.escape || input === 'b') {
      if (query || statusFilter !== 'all' || priorityFilter !== 'all') {
        setQuery('');
        setStatusFilter('all');
        setPriorityFilter('all');
        return;
      }
      onBack();
      return;
    }
    if (key.upArrow || input === 'k') {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setCursor((c) => Math.min(visible.length - 1, c + 1));
      return;
    }
    if (input === 'n') {
      onCreate();
      return;
    }
    if (input === 'r') {
      load();
      return;
    }
    if (input === '/') {
      setSearchDraft(query);
      setSearching(true);
      return;
    }
    if (input === '>' || input === ']') {
      onSwitchProject(1);
      return;
    }
    if (input === '<' || input === '[') {
      onSwitchProject(-1);
      return;
    }
    if (input === 'f') {
      setStatusFilter((v) => cycle(STATUS_FILTERS, v, 1));
      return;
    }
    if (input === 'F') {
      setStatusFilter((v) => cycle(STATUS_FILTERS, v, -1));
      return;
    }
    if (input === 'p') {
      setPriorityFilter((v) => cycle(PRIORITY_FILTERS, v, 1));
      return;
    }
    if (input === 'P') {
      setPriorityFilter((v) => cycle(PRIORITY_FILTERS, v, -1));
      return;
    }
    const current = visible[cursor];
    if (!current) return;

    if (key.return) {
      onOpenTask(current);
      return;
    }
    if (input === 'e') {
      onEdit(current);
      return;
    }
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

  const submitSearch = () => {
    setQuery(searchDraft);
    setSearching(false);
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

  const filterChip = (active: boolean, label: string, color?: string) => (
    <Text color={active ? color ?? 'green' : 'gray'} bold={active}>
      [{label}]
    </Text>
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        flexDirection="column"
      >
        <Box>
          <Text bold color="cyan">
            {project.name}
          </Text>
          <Text dimColor>
            {' '}
            — {visible.length}/{tasks.length} task{tasks.length === 1 ? '' : 's'}
          </Text>
        </Box>
        <Box>
          <Text dimColor>status </Text>
          {filterChip(statusFilter !== 'all', statusFilter, 'cyan')}
          <Text dimColor>  priority </Text>
          {filterChip(priorityFilter !== 'all', priorityFilter, 'magenta')}
          {query && (
            <>
              <Text dimColor>  search </Text>
              {filterChip(true, `"${query}"`, 'yellow')}
            </>
          )}
        </Box>
        <Text dimColor>
          j/k: move · enter: open · e: edit · space: done · n: new · d: del · /: search · f/p: filter · {'<'}/{'>'}: switch proj · r: reload · esc: clear/back
        </Text>
      </Box>

      {searching && (
        <Box
          borderStyle="round"
          borderColor="yellow"
          paddingX={1}
          marginTop={1}
        >
          <Text color="yellow">/ </Text>
          <TextInput
            value={searchDraft}
            onChange={setSearchDraft}
            onSubmit={submitSearch}
            focus
            placeholder="search title, body, tags…"
          />
        </Box>
      )}

      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginTop={1}
        flexDirection="column"
      >
        {visible.length === 0 && (
          <Text dimColor>
            {tasks.length === 0
              ? 'No tasks. Press n to create one.'
              : 'No tasks match the current filter.'}
          </Text>
        )}
        {visible.map((t, i) => {
          const selected = i === cursor;
          const done = t.status === 'done';
          const inProgress = t.status === 'in-progress';
          const iconColor = done ? 'gray' : inProgress ? 'yellow' : undefined;
          return (
            <Box key={t.id}>
              <Text color={selected ? 'green' : undefined}>{selected ? '▶ ' : '  '}</Text>
              <Text color={iconColor}>
                {statusIcon(t.status)} {priorityMark(t.priority)}{' '}
              </Text>
              <Text color={done ? 'gray' : undefined} strikethrough={done}>
                {t.title}
              </Text>
              {t.dueDate && <Text dimColor> · due {t.dueDate}</Text>}
              {t.tags.length > 0 && (
                <Text dimColor> · {t.tags.map((x) => `#${x}`).join(' ')}</Text>
              )}
            </Box>
          );
        })}
      </Box>
      {busy && (
        <Box marginTop={1} paddingX={1}>
          <Text color="yellow">
            <Spinner type="dots" /> working…
          </Text>
        </Box>
      )}
    </Box>
  );
}
