import React, { useState } from 'react';
import { Box, Text } from 'ink';
import Login from './screens/login.js';
import Projects from './screens/projects.js';
import Tasks from './screens/tasks.js';
import { clearSession, loadSession, type Session } from './storage.js';
import { clientFromSession, type Project } from './api.js';

interface Props {
  apiUrl: string;
}

export default function App({ apiUrl }: Props) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadSession();
    return s && s.accessToken ? { ...s, apiUrl } : null;
  });
  const [project, setProject] = useState<Project | null>(null);

  if (!session) {
    return <Login apiUrl={apiUrl} onLoggedIn={setSession} />;
  }

  const client = clientFromSession(session);

  if (!project) {
    return (
      <Box flexDirection="column">
        <Box paddingX={1}>
          <Text dimColor>
            Signed in as <Text color="cyan">{session.name}</Text> ({session.email})
          </Text>
        </Box>
        <Projects
          client={client}
          onPick={setProject}
          onLogout={() => {
            clearSession();
            setSession(null);
          }}
        />
      </Box>
    );
  }

  return <Tasks client={client} project={project} onBack={() => setProject(null)} />;
}
