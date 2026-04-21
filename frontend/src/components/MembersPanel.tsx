import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { X, UserPlus, Users, Trash2, Shield, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Avatar from './Avatar';
import * as api from '../api/client';
import type { Member, Invitation } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../context/AppState';
import { useToast } from '../context/ToastContext';

interface Props {
  projectId: string;
  onClose: () => void;
  embedded?: boolean;
}

const MembersPanel: React.FC<Props> = ({ projectId, onClose, embedded = false }) => {
  const { user } = useAuth();
  const { state } = useAppState();
  const { success, error: toastError } = useToast();
  const project = state.projects.find((p) => p.id === projectId);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, i] = await Promise.all([
        api.members.list(projectId),
        api.members.listInvitations(projectId),
      ]);
      setMembers(m);
      setInvitations(i);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [projectId, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isAdmin = useMemo(
    () => !!user && members.some((m) => m.userId === user.id && m.role === 'admin'),
    [members, user]
  );

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setInviting(true);
    try {
      const inv = await api.members.invite(projectId, trimmed);
      setInvitations((xs) => [inv, ...xs]);
      setEmail('');
      success(`Invitation sent to ${trimmed}`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const remove = async (m: Member) => {
    if (!window.confirm(`Remove ${m.name} from ${project?.name ?? 'project'}?`)) return;
    try {
      await api.members.remove(projectId, m.userId);
      setMembers((xs) => xs.filter((x) => x.userId !== m.userId));
      success(`${m.name} removed`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const pendingInvs = invitations.filter((i) => i.status === 'pending');

  const card = (
    <div className="w-full max-w-xl bg-bg border border-border rounded-2xl shadow-xl my-12">
        <header className="flex items-center gap-3 px-5 py-4 border-b border-border-light">
          <Users size={18} className="text-accent" />
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary">Members</h2>
            <div className="text-2xs text-text-tertiary">{project?.name}</div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto">
          {isAdmin && (
            <form
              onSubmit={invite}
              className="flex items-center gap-2 px-5 py-4 border-b border-border-light"
            >
              <input
                type="email"
                placeholder="email to invite"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-[13px] text-text-primary outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={inviting || !email.trim()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-text-inverse text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-base"
              >
                <UserPlus size={14} />
                Invite
              </button>
            </form>
          )}

          {loading ? (
            <div className="p-8 text-center text-text-tertiary text-[13px]">Loading…</div>
          ) : (
            <>
              <section className="px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
                  {members.length} member{members.length === 1 ? '' : 's'}
                </div>
                <ul className="space-y-2">
                  {members.map((m) => {
                    const isSelf = user?.id === m.userId;
                    return (
                      <li
                        key={m.userId}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-hover transition-base"
                      >
                        <Avatar seed={m.avatarSeed ?? m.userId} name={m.name} size={36} className="rounded-full" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-text-primary truncate flex items-center gap-2">
                            {m.name}
                            {isSelf && <span className="text-2xs text-text-tertiary">(you)</span>}
                          </div>
                          <div className="text-2xs text-text-tertiary truncate">{m.email}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {m.role === 'admin' && (
                            <span className="flex items-center gap-1 text-2xs text-accent px-2 py-0.5 rounded-full bg-accent-light">
                              <Shield size={11} />
                              admin
                            </span>
                          )}
                          {(isAdmin || isSelf) && (
                            <button
                              onClick={() => remove(m)}
                              title={isSelf ? 'Leave project' : 'Remove'}
                              className="p-1.5 rounded-md text-text-tertiary hover:text-danger hover:bg-danger-bg transition-base"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {pendingInvs.length > 0 && (
                <section className="px-5 py-4 border-t border-border-light">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary mb-3">
                    Pending invitations
                  </div>
                  <ul className="space-y-2">
                    {pendingInvs.map((inv) => (
                      <li
                        key={inv.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-border-light"
                      >
                        <Clock size={16} className="text-text-tertiary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-text-primary truncate">{inv.inviteeEmail}</div>
                          <div className="text-2xs text-text-tertiary">
                            Expires {formatDistanceToNow(new Date(inv.expiresAt), { addSuffix: true })}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
  );

  if (embedded) return card;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 overflow-y-auto animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {card}
    </div>
  );
};

export default MembersPanel;
