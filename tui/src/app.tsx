import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import Login from './screens/login.js';
import Projects from './screens/projects.js';
import Tasks from './screens/tasks.js';
import TaskDetail from './screens/task-detail.js';
import TaskForm from './screens/task-form.js';
import Inbox from './screens/inbox.js';
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
  const [inboxOpen, setInboxOpen] = useState(false);
  const [projectCache, setProjectCache] = useState<Project[]>([]);

  const client = session
    ? clientFromSession(session, {
        onExpired: () => {
          setProject(null);
          setOpenTaskId(null);
          setForm(null);
          setInboxOpen(false);
          setSession(null);
        },
      })
    : null;

  useEffect(() => {
    if (!client || !project) return;
    client
      .listProjects()
      .then((ps) => setProjectCache([...ps].sort((a, b) => a.position - b.position)))
      .catch(() => {});
  }, [client, project?.id]);

  if (!session || !client) {
    return <Login apiUrl={apiUrl} onLoggedIn={setSession} />;
  }

  if (inboxOpen) {
    return <Inbox client={client} onBack={() => setInboxOpen(false)} />;
  }

  if (!project) {
    return (
      <Box flexDirection="column">
        <Box paddingX={1}>
          <Text dimColor>
            Signed in as <Text color="cyan">{session.name}</Text> ({session.email}) · press{' '}
            <Text color="cyan">i</Text> for inbox
          </Text>
        </Box>
        <Projects
          client={client}
          onPick={setProject}
          onLogout={() => {
            clearSession();
            setSession(null);
          }}
          onOpenInbox={() => setInboxOpen(true)}
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
      onSwitchProject={(dir) => {
        if (projectCache.length === 0) return;
        const idx = projectCache.findIndex((p) => p.id === project.id);
        if (idx === -1) return;
        const next = projectCache[(idx + dir + projectCache.length) % projectCache.length];
        if (next) setProject(next);
      }}
    />
  );
}
