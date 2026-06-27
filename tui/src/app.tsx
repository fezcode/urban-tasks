import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Login from './screens/login.js';
import Projects from './screens/projects.js';
import Tasks from './screens/tasks.js';
import TaskDetail from './screens/task-detail.js';
import TaskForm from './screens/task-form.js';
import Pinboard from './screens/pinboard.js';
import Inbox from './screens/inbox.js';
import Help from './screens/help.js';
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
  const [boardOpen, setBoardOpen] = useState(false);
  const [projectCache, setProjectCache] = useState<Project[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);

  useInput((input) => {
    if (!session) return;
    if (input === '?') setHelpOpen((h) => !h);
  });

  const client = session
    ? clientFromSession(session, {
        onExpired: () => {
          setProject(null);
          setOpenTaskId(null);
          setForm(null);
          setInboxOpen(false);
          setBoardOpen(false);
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

  if (helpOpen) {
    return <Help onClose={() => setHelpOpen(false)} />;
  }

  if (inboxOpen) {
    return <Inbox client={client} onBack={() => setInboxOpen(false)} />;
  }

  if (!project) {
    return (
      <Box flexDirection="column">
        <Box paddingX={1}>
          <Text dimColor>
            Signed in as <Text color="cyan">{session.name}</Text> ({session.email}){' '}
            <PlanChip session={session} /> · press <Text color="cyan">i</Text> for inbox
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

  if (boardOpen) {
    return (
      <Pinboard
        client={client}
        project={project}
        onBack={() => setBoardOpen(false)}
        onOpenTask={(t: Task) => setOpenTaskId(t.id)}
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
      onOpenBoard={() => setBoardOpen(true)}
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

function PlanChip({ session }: { session: Session }) {
  const effective = session.effectivePlan ?? session.plan;
  if (!effective) return null;
  const isTrial =
    effective === 'pro' && session.plan === 'free' && !!session.trialEndsAt;
  if (isTrial && session.trialEndsAt) {
    const days = Math.max(
      0,
      Math.ceil((new Date(session.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );
    return <Text color="yellow">[Pro trial · {days}d]</Text>;
  }
  if (effective === 'pro') return <Text color="green">[Pro]</Text>;
  return <Text dimColor>[Free]</Text>;
}
