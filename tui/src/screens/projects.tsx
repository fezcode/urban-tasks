import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import type { Client, Project } from '../api.js';

interface Props {
  client: Client;
  onPick: (p: Project) => void;
  onLogout: () => void;
  onOpenInbox: () => void;
}

type Mode = 'list' | 'create-name' | 'create-color';

const COLORS = ['#C96442', '#6B8E23', '#4682B4', '#B5651D', '#8B5CF6', '#10B981', '#F59E0B'];

export default function Projects({ client, onPick, onLogout, onOpenInbox }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [mode, setMode] = useState<Mode>('list');
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState('#C96442');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    client
      .listProjects()
      .then((ps) => setProjects([...ps].sort((a, b) => a.position - b.position)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [client]);

  useEffect(() => {
    load();
  }, [load]);

  useInput(async (input, key) => {
    if (busy || mode !== 'list' || !projects) return;
    if (input === 'q') process.exit(0);
    if (input === 'l') {
      onLogout();
      return;
    }
    if (input === 'i') {
      onOpenInbox();
      return;
    }
    if (input === 'r') {
      load();
      return;
    }
    if (input === 'N') {
      setDraftName('');
      setDraftColor(COLORS[0]!);
      setMode('create-name');
      return;
    }
    if (projects.length === 0) return;
    if (key.upArrow || input === 'k') {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setCursor((c) => Math.min(projects.length - 1, c + 1));
      return;
    }
    if (key.return) {
      const p = projects[cursor];
      if (p) onPick(p);
      return;
    }
    if (input === 'd') {
      const p = projects[cursor];
      if (!p) return;
      setBusy(true);
      try {
        await client.deleteProject(p.id);
        load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Delete failed');
      } finally {
        setBusy(false);
      }
    }
  });

  useInput((input, key) => {
    if (mode !== 'create-color') return;
    if (key.escape) {
      setMode('list');
      return;
    }
    if (key.leftArrow || input === 'h') {
      const i = COLORS.indexOf(draftColor);
      setDraftColor(COLORS[(i - 1 + COLORS.length) % COLORS.length]!);
      return;
    }
    if (key.rightArrow || input === 'l') {
      const i = COLORS.indexOf(draftColor);
      setDraftColor(COLORS[(i + 1) % COLORS.length]!);
      return;
    }
    if (key.return) {
      void submitCreate();
    }
  });

  const submitCreate = async () => {
    const name = draftName.trim();
    if (!name) {
      setMode('list');
      return;
    }
    setBusy(true);
    try {
      await client.createProject(name, draftColor);
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
        <Text dimColor>Press l to logout, q to quit</Text>
      </Box>
    );
  }

  if (!projects) {
    return (
      <Box padding={1}>
        <Text color="yellow">
          <Spinner type="dots" /> Loading projects…
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        flexDirection="column"
      >
        <Text bold color="cyan">
          Projects
        </Text>
        <Text dimColor>
          j/k: move · enter: open · N: new · d: delete · i: inbox · r: reload · l: logout · q: quit · ?: help
        </Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginTop={1}
        flexDirection="column"
      >
        {projects.length === 0 && <Text dimColor>No projects. Press N to create one.</Text>}
        {projects.map((p, i) => {
          const selected = i === cursor;
          return (
            <Box key={p.id}>
              <Text color={selected ? 'green' : undefined}>{selected ? '▶ ' : '  '}</Text>
              <Text color={p.color}>●</Text>
              <Text> {p.name}</Text>
            </Box>
          );
        })}
      </Box>

      {mode === 'create-name' && (
        <Box
          borderStyle="round"
          borderColor="green"
          paddingX={1}
          marginTop={1}
          flexDirection="column"
        >
          <Text bold color="green">
            New project
          </Text>
          <Box>
            <Text>name: </Text>
            <TextInput
              value={draftName}
              onChange={setDraftName}
              onSubmit={() => {
                if (!draftName.trim()) {
                  setMode('list');
                  return;
                }
                setMode('create-color');
              }}
              focus
              placeholder="project name"
            />
          </Box>
          <Text dimColor>Enter: next · Esc: cancel</Text>
        </Box>
      )}

      {mode === 'create-color' && (
        <Box
          borderStyle="round"
          borderColor="green"
          paddingX={1}
          marginTop={1}
          flexDirection="column"
        >
          <Text bold color="green">
            Color
          </Text>
          <Box>
            {COLORS.map((c) => (
              <Text
                key={c}
                color={c}
                bold={c === draftColor}
              >
                {c === draftColor ? '[●]' : ' ● '}
              </Text>
            ))}
          </Box>
          <Text dimColor>←/→: choose · Enter: create · Esc: cancel</Text>
        </Box>
      )}

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
