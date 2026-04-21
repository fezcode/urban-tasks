import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Client, Task } from '../api.js';

interface Props {
  client: Client;
  projectId: string;
  initial?: Task;
  onDone: (task: Task | null) => void; // null = cancelled
}

type Field =
  | 'title'
  | 'body'
  | 'priority'
  | 'status'
  | 'dueDate'
  | 'startDate'
  | 'tags'
  | 'recurrence';

const PRIORITIES = ['low', 'medium', 'high'] as const;
const STATUSES = ['todo', 'in-progress', 'done'] as const;
const RECURRENCES = ['', 'daily', 'weekly', 'biweekly', 'monthly'] as const;

type Enum = readonly string[];

function cycle(list: Enum, current: string, dir: 1 | -1): string {
  const i = list.indexOf(current);
  const base = i === -1 ? 0 : i;
  const next = (base + dir + list.length) % list.length;
  return list[next] ?? list[0] ?? '';
}

function isValidDate(s: string): boolean {
  if (!s) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function TaskForm({ client, projectId, initial, onDone }: Props) {
  const editing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [priority, setPriority] = useState<string>(initial?.priority ?? 'medium');
  const [status, setStatus] = useState<string>(initial?.status ?? 'todo');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [tagsText, setTagsText] = useState((initial?.tags ?? []).join(', '));
  const [recurrence, setRecurrence] = useState<string>(initial?.recurrence ?? '');

  const fieldOrder: Field[] = editing
    ? ['title', 'body', 'priority', 'status', 'dueDate', 'startDate', 'tags', 'recurrence']
    : ['title', 'body', 'priority', 'dueDate', 'startDate', 'tags', 'recurrence'];

  const [focus, setFocus] = useState<Field>('title');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEnum = (f: Field) => f === 'priority' || f === 'status' || f === 'recurrence';

  const moveFocus = (delta: number) => {
    const i = fieldOrder.indexOf(focus);
    setFocus(fieldOrder[(i + delta + fieldOrder.length) % fieldOrder.length]!);
  };

  useInput((input, key) => {
    if (busy) return;
    if (key.escape) {
      onDone(null);
      return;
    }
    if (key.ctrl && input === 's') {
      submit();
      return;
    }
    if (key.tab) {
      moveFocus(key.shift ? -1 : 1);
      return;
    }
    // enum field: arrows cycle value; up/down move fields
    if (isEnum(focus)) {
      if (key.leftArrow || input === 'h') {
        if (focus === 'priority') setPriority((v) => cycle(PRIORITIES, v, -1));
        if (focus === 'status') setStatus((v) => cycle(STATUSES, v, -1));
        if (focus === 'recurrence') setRecurrence((v) => cycle(RECURRENCES, v, -1));
        return;
      }
      if (key.rightArrow || input === 'l') {
        if (focus === 'priority') setPriority((v) => cycle(PRIORITIES, v, 1));
        if (focus === 'status') setStatus((v) => cycle(STATUSES, v, 1));
        if (focus === 'recurrence') setRecurrence((v) => cycle(RECURRENCES, v, 1));
        return;
      }
      if (key.upArrow || input === 'k') {
        moveFocus(-1);
        return;
      }
      if (key.downArrow || input === 'j') {
        moveFocus(1);
        return;
      }
      if (key.return) {
        const i = fieldOrder.indexOf(focus);
        if (i === fieldOrder.length - 1) submit();
        else moveFocus(1);
        return;
      }
    } else {
      // text field: up/down move between fields (TextInput ignores them)
      if (key.upArrow) {
        moveFocus(-1);
        return;
      }
      if (key.downArrow) {
        moveFocus(1);
        return;
      }
    }
  });

  const submit = async () => {
    const t = title.trim();
    if (!t) {
      setError('title is required');
      setFocus('title');
      return;
    }
    if (!isValidDate(dueDate)) {
      setError('dueDate must be YYYY-MM-DD');
      setFocus('dueDate');
      return;
    }
    if (!isValidDate(startDate)) {
      setError('startDate must be YYYY-MM-DD');
      setFocus('startDate');
      return;
    }
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setBusy(true);
    setError(null);
    try {
      if (editing && initial) {
        const updated = await client.updateTask(initial.id, {
          title: t,
          body,
          priority,
          status,
          tags,
          dueDate,
          startDate,
          recurrence,
        });
        onDone(updated);
      } else {
        const created = await client.createTask({
          projectId,
          title: t,
          body: body || undefined,
          priority,
          tags: tags.length ? tags : undefined,
          dueDate: dueDate || undefined,
          startDate: startDate || undefined,
          recurrence: recurrence || undefined,
        });
        onDone(created);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
      setBusy(false);
    }
  };

  const label = (f: Field, text: string) => (
    <Text color={focus === f ? 'green' : undefined} bold={focus === f}>
      {focus === f ? '▶ ' : '  '}
      {text.padEnd(11)}
    </Text>
  );

  const enumValue = (f: Field, value: string, list: Enum) => (
    <Box>
      {label(f, f)}
      <Text dimColor>{focus === f ? '◂ ' : '  '}</Text>
      <Text color={focus === f ? 'cyan' : undefined}>{value || '(none)'}</Text>
      <Text dimColor>{focus === f ? ' ▸' : '  '}</Text>
      <Text dimColor>  options: {list.map((v) => v || '(none)').join(', ')}</Text>
    </Box>
  );

  const textField = (
    f: Field,
    value: string,
    setValue: (v: string) => void,
    placeholder?: string,
  ) => (
    <Box>
      {label(f, f)}
      <TextInput
        value={value}
        onChange={setValue}
        focus={focus === f && !busy}
        placeholder={placeholder}
        onSubmit={() => {
          const i = fieldOrder.indexOf(f);
          if (i === fieldOrder.length - 1) submit();
          else setFocus(fieldOrder[i + 1]!);
        }}
      />
    </Box>
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        flexDirection="column"
      >
        <Text bold color="cyan">
          {editing ? 'Edit task' : 'New task'}
        </Text>
        <Text dimColor>
          Tab / ↑↓: move · ←→ or h/l: cycle options · Enter: next/submit · Ctrl+S: save · Esc: cancel
        </Text>
      </Box>
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginTop={1}
        flexDirection="column"
      >
        {textField('title', title, setTitle, 'required')}
        {textField('body', body, setBody, 'description (single line for now)')}
        {enumValue('priority', priority, PRIORITIES)}
        {editing && enumValue('status', status, STATUSES)}
        {textField('dueDate', dueDate, setDueDate, 'YYYY-MM-DD')}
        {textField('startDate', startDate, setStartDate, 'YYYY-MM-DD')}
        {textField('tags', tagsText, setTagsText, 'comma, separated')}
        {enumValue('recurrence', recurrence, RECURRENCES)}
      </Box>
      {error && (
        <Box marginTop={1} paddingX={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
      {busy && (
        <Box marginTop={1} paddingX={1}>
          <Text color="yellow">
            <Spinner type="dots" /> saving…
          </Text>
        </Box>
      )}
    </Box>
  );
}
