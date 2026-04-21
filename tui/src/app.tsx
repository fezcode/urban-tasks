import React, { useState } from 'react';
import { Box, Text } from 'ink';
import Login from './screens/login.js';
import Projects from './screens/projects.js';
import Tasks from './screens/tasks.js';
import TaskDetail from './screens/task-detail.js';
import TaskForm from './screens/task-form.js';
import { clearSession, loadSession, type Session } from './storage.js';
import { clientFromSession, type Project, type Task } from './api.js';

interface Props {
  apiUrl: string;
}

type FormState =
  | { kind: 'create' }
  | { kind: 'edit'; task: Task };

export default function App({ apiUrl }: Props) {
  const [session, setSession] = useState<Session | null>(() => {
    const s = loadSession();
    return s && s.accessToken ? { ...s, apiUrl } : null;
  });
  const [project, setProject] = useState<Project | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [listKey, setListKey] = useState(0);

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

  if (form) {
    return (
      <TaskForm
        client={client}
        projectId={project.id}
        initial={form.kind === 'edit' ? form.task : undefined}
        onDone={(task) => {
          setForm(null);
          if (task) {
            setListKey((k) => k + 1);
            if (form.kind === 'edit') {
              // stay on detail with refreshed task
              setOpenTaskId(task.id);
            }
          }
        }}
      />
    );
  }

  if (openTaskId) {
    return (
      <TaskDetail
        client={client}
        taskId={openTaskId}
        onBack={(changed) => {
          setOpenTaskId(null);
          if (changed) setListKey((k) => k + 1);
        }}
        onEdit={(task) => setForm({ kind: 'edit', task })}
      />
    );
  }

  return (
    <Tasks
      key={listKey}
      client={client}
      project={project}
      onBack={() => setProject(null)}
      onOpenTask={(t: Task) => setOpenTaskId(t.id)}
      onCreate={() => setForm({ kind: 'create' })}
      onEdit={(t: Task) => setForm({ kind: 'edit', task: t })}
    />
  );
}
