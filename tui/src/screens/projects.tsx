import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import type { Client, Project } from '../api.js';

interface Props {
  client: Client;
  onPick: (p: Project) => void;
  onLogout: () => void;
}

export default function Projects({ client, onPick, onLogout }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client
      .listProjects()
      .then((ps) => setProjects([...ps].sort((a, b) => a.position - b.position)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [client]);

  useInput((input) => {
    if (input === 'q') process.exit(0);
    if (input === 'l') onLogout();
  });

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

  if (projects.length === 0) {
    return (
      <Box padding={1} flexDirection="column">
        <Text>No projects yet. Create one on the web or mobile app.</Text>
        <Text dimColor>l: logout · q: quit</Text>
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
        <Text dimColor>Enter: open · l: logout · q: quit</Text>
      </Box>
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginTop={1}
      >
        <SelectInput
          items={projects.map((p) => ({
            key: p.id,
            label: `● ${p.name}`,
            value: p,
          }))}
          onSelect={(item) => onPick(item.value as Project)}
        />
      </Box>
    </Box>
  );
}
