import React, { useCallback, useEffect, useState } from 'react';
import { X, Check, Ban, BellRing, Mail, Inbox as InboxIcon, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import * as api from '../api/client';
import type { Invitation, Notification } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAppState } from '../context/AppState';

interface Props {
  onClose?: () => void;
  onChanged?: () => void;
  embedded?: boolean;
}

const InboxPanel: React.FC<Props> = ({ onClose, onChanged, embedded = false }) => {
  const { success, error: toastError } = useToast();
  const { reload } = useAppState();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [invs, n] = await Promise.all([
        api.invitations.listMine(),
        api.notifications.list(),
      ]);
      setInvitations(invs);
      setNotifications(n.items);
    } catch {
      toastError('Failed to load inbox');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const respond = async (inv: Invitation, accept: boolean) => {
    try {
      if (accept) await api.invitations.accept(inv.id);
      else await api.invitations.reject(inv.id);
      success(accept ? `Joined “${inv.projectName ?? 'project'}”` : 'Invitation declined');
      setInvitations((xs) => xs.filter((x) => x.id !== inv.id));
      if (accept) await reload();
      onChanged?.();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Request failed');
    }
  };

  const markRead = async (n: Notification) => {
    if (n.readAt) return;
    try {
      await api.notifications.markRead(n.id);
      setNotifications((xs) =>
        xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
      );
      onChanged?.();
    } catch {
      /* noop */
    }
  };

  const markAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      setNotifications((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
      onChanged?.();
    } catch {
      toastError('Failed to mark all read');
    }
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const card = (
    <div className="w-full max-w-2xl bg-bg border border-border rounded-2xl shadow-xl my-12">
      <header className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
        <InboxIcon size={18} className="text-accent" />
        <h2 className="text-[15px] font-semibold text-text-primary">Inbox</h2>
        <div className="ml-auto flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-[12px] text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-surface-hover transition-base"
            >
              <CheckCheck size={14} />
              Mark all read
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </header>

      <div className="max-h-[70vh] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-text-tertiary text-[13px]">Loading…</div>
        ) : (
          <>
            {invitations.length > 0 && (
              <section className="px-5 py-4 border-b border-border-light">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
                  Invitations
                </div>
                <ul className="space-y-2">
                  {invitations.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-start gap-3 p-3 rounded-xl bg-surface border border-border-light"
                    >
                      <span
                        className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: (inv.projectColor || '#C96442') + '22' }}
                      >
                        <Mail size={16} style={{ color: inv.projectColor || '#C96442' }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-text-primary">
                          <span className="font-medium">{inv.inviterName || 'Someone'}</span>
                          {' invited you to '}
                          <span className="font-medium">{inv.projectName || 'a project'}</span>
                        </div>
                        <div className="text-2xs text-text-tertiary mt-0.5">
                          Expires{' '}
                          {formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => respond(inv, true)}
                          className="p-1.5 rounded-md text-success hover:bg-status-active/10 transition-base"
                          title="Accept"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => respond(inv, false)}
                          className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-danger-bg transition-base"
                          title="Decline"
                        >
                          <Ban size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="px-5 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
                Notifications
              </div>
              {notifications.length === 0 && invitations.length === 0 ? (
                <div className="py-12 text-center text-text-tertiary text-[13px]">
                  Nothing new.
                </div>
              ) : notifications.length === 0 ? (
                <div className="py-8 text-center text-text-tertiary text-[13px]">
                  No notifications.
                </div>
              ) : (
                <ul className="space-y-1">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      onClick={() => markRead(n)}
                      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-base ${
                        n.readAt
                          ? 'opacity-60 hover:bg-surface-hover'
                          : 'bg-accent-light/40 hover:bg-accent-light'
                      }`}
                    >
                      <BellRing
                        size={16}
                        className={n.readAt ? 'text-text-tertiary mt-0.5' : 'text-accent mt-0.5'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-text-primary">
                          {formatNotification(n)}
                        </div>
                        <div className="text-2xs text-text-tertiary mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return card;
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      {card}
    </div>
  );
};

function formatNotification(n: Notification): string {
  const p = n.payload || {};
  switch (n.kind) {
    case 'invitation_received':
      return `${p.inviterName ?? 'Someone'} invited you to ${p.projectName ?? 'a project'}`;
    case 'invitation_accepted':
      return `${p.inviteeName ?? p.inviteeEmail ?? 'Someone'} joined ${p.projectName ?? 'your project'}`;
    case 'invitation_rejected':
      return `${p.inviteeName ?? p.inviteeEmail ?? 'Someone'} declined your invitation to ${p.projectName ?? 'a project'}`;
    default:
      return n.kind.replace(/_/g, ' ');
  }
}

export default InboxPanel;
