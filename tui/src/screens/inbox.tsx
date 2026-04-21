import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import type { Client, Invitation, Notification } from '../api.js';

interface Props {
  client: Client;
  onBack: () => void;
}

type Row =
  | { kind: 'invitation'; invitation: Invitation }
  | { kind: 'notification'; notification: Notification };

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function timeTo(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
}

function formatNotification(n: Notification): string {
  const p = (n.payload ?? {}) as Record<string, unknown>;
  const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
  switch (n.kind) {
    case 'invitation_received':
      return `${s('inviterName') ?? 'Someone'} invited you to ${s('projectName') ?? 'a project'}`;
    case 'invitation_accepted':
      return `${s('inviteeName') ?? s('inviteeEmail') ?? 'Someone'} joined ${s('projectName') ?? 'your project'}`;
    case 'invitation_rejected':
      return `${s('inviteeName') ?? s('inviteeEmail') ?? 'Someone'} declined ${s('projectName') ?? 'your invitation'}`;
    case 'task_assigned':
      return `${s('assignerName') ?? 'Someone'} assigned you "${s('taskTitle') ?? 'a task'}"${
        s('projectName') ? ` in ${s('projectName')}` : ''
      }`;
    default:
      return n.kind.replace(/_/g, ' ');
  }
}

export default function Inbox({ client, onBack }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [invs, ns] = await Promise.all([
        client.listInvitations(),
        client.listNotifications(),
      ]);
      setInvitations(invs);
      setNotifications(ns.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: Row[] = useMemo(
    () => [
      ...invitations.map((i) => ({ kind: 'invitation' as const, invitation: i })),
      ...notifications.map((n) => ({ kind: 'notification' as const, notification: n })),
    ],
    [invitations, notifications],
  );

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const unread = notifications.filter((n) => !n.readAt).length;

  useInput(async (input, key) => {
    if (busy || loading) return;
    if (key.escape || input === 'b') {
      onBack();
      return;
    }
    if (input === 'r') {
      setLoading(true);
      void load();
      return;
    }
    if (key.upArrow || input === 'k') {
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (key.downArrow || input === 'j') {
      setCursor((c) => Math.min(rows.length - 1, c + 1));
      return;
    }
    if (input === 'A' && unread > 0) {
      setBusy(true);
      try {
        await client.markAllNotificationsRead();
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed');
      } finally {
        setBusy(false);
      }
      return;
    }
    const row = rows[cursor];
    if (!row) return;

    if (row.kind === 'invitation') {
      if (input === 'a' || input === 'y') {
        setBusy(true);
        try {
          await client.acceptInvitation(row.invitation.id);
          await load();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Accept failed');
        } finally {
          setBusy(false);
        }
        return;
      }
      if (input === 'x' || input === 'n') {
        setBusy(true);
        try {
          await client.rejectInvitation(row.invitation.id);
          await load();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Reject failed');
        } finally {
          setBusy(false);
        }
        return;
      }
    } else {
      if ((input === 'm' || key.return) && !row.notification.readAt) {
        setBusy(true);
        try {
          await client.markNotificationRead(row.notification.id);
          await load();
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Failed');
        } finally {
          setBusy(false);
        }
      }
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text color="yellow">
          <Spinner type="dots" /> Loading inbox…
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">Error: {error}</Text>
        <Text dimColor>b/esc: back · r: reload</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
        <Box>
          <Text bold color="cyan">
            Inbox
          </Text>
          <Text dimColor>
            {' '}
            — {invitations.length} invitation{invitations.length === 1 ? '' : 's'} · {unread}{' '}
            unread
          </Text>
        </Box>
        <Text dimColor>
          j/k: move · a/y: accept · x/n: reject · m/enter: mark read · A: mark all · r: reload · b/esc: back
        </Text>
      </Box>

      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginTop={1}
        flexDirection="column"
      >
        {rows.length === 0 && <Text dimColor>Nothing new.</Text>}
        {rows.map((row, i) => {
          const selected = i === cursor;
          const prefix = selected ? '▶ ' : '  ';
          if (row.kind === 'invitation') {
            const inv = row.invitation;
            return (
              <Box key={`inv-${inv.id}`}>
                <Text color={selected ? 'green' : undefined}>{prefix}</Text>
                <Text color="magenta">✉ </Text>
                <Text>
                  <Text bold>{inv.inviterName ?? 'Someone'}</Text> invited you to{' '}
                  <Text bold color={inv.projectColor}>
                    {inv.projectName ?? 'a project'}
                  </Text>
                </Text>
                <Text dimColor> · expires {timeTo(inv.expiresAt)}</Text>
              </Box>
            );
          }
          const n = row.notification;
          const isUnread = !n.readAt;
          return (
            <Box key={`n-${n.id}`}>
              <Text color={selected ? 'green' : undefined}>{prefix}</Text>
              <Text color={isUnread ? 'cyan' : 'gray'}>{isUnread ? '●' : '○'} </Text>
              <Text color={isUnread ? undefined : 'gray'}>{formatNotification(n)}</Text>
              <Text dimColor> · {timeAgo(n.createdAt)}</Text>
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
