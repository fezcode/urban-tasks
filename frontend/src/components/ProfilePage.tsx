import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Check, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Avatar, { randomAvatarSeed } from './Avatar';

interface Props {
  onClose: () => void;
}

const ProfilePage: React.FC<Props> = ({ onClose }) => {
  const { user, updateProfile, deleteAccount } = useAuth();
  const { success, error: toastError } = useToast();

  const [name, setName] = useState(user?.name ?? '');
  const [avatarSeed, setAvatarSeed] = useState<string>(user?.avatarSeed ?? user?.id ?? '');
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'idle' | 'confirming'>('idle');
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && deleteMode === 'idle') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, deleteMode]);

  if (!user) return null;

  const nameChanged = name.trim() !== user.name && name.trim().length > 0;
  const avatarChanged = avatarSeed !== (user.avatarSeed ?? '');

  const handleSaveName = async () => {
    if (!nameChanged) return;
    setSavingName(true);
    try {
      await updateProfile({ name: name.trim() });
      success('Name updated');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Could not update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleRegenerateAvatar = () => {
    setAvatarSeed(randomAvatarSeed());
  };

  const handleSaveAvatar = async () => {
    setSavingAvatar(true);
    try {
      await updateProfile({ avatarSeed });
      success('Avatar saved');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Could not update avatar');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleDelete = async () => {
    if (deleteText !== user.email) return;
    setDeleting(true);
    try {
      await deleteAccount();
      // Navigation back to auth happens automatically via AuthContext state.
    } catch (e) {
      setDeleting(false);
      toastError(e instanceof Error ? e.message : 'Could not delete account');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-6 animate-fade-in overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
    >
      <div
        className="relative w-full max-w-2xl bg-[#F5EFE6] text-[#1F1B17] rounded-none sm:rounded-[28px] shadow-2xl overflow-hidden my-0 sm:my-6"
        style={{
          boxShadow:
            '0 40px 80px -20px rgba(31, 27, 23, 0.35), 0 0 0 1px rgba(31, 27, 23, 0.06)',
        }}
      >
        {/* Decorative grain/terracotta wash at top */}
        <div
          className="absolute inset-x-0 top-0 h-56 pointer-events-none -z-0"
          style={{
            background:
              'radial-gradient(140% 120% at 50% 0%, rgba(201,100,66,0.32) 0%, rgba(201,100,66,0) 60%)',
          }}
        />

        <button
          onClick={onClose}
          aria-label="Close profile"
          className="absolute right-4 top-4 z-10 p-2 rounded-full text-[#1F1B17]/45 hover:text-[#1F1B17] hover:bg-[#1F1B17]/5 transition-base"
        >
          <X size={18} />
        </button>

        <div className="relative z-1 px-6 sm:px-10 pt-10 pb-10 space-y-10">
          {/* Header */}
          <header className="flex items-start gap-5">
            <Avatar seed={avatarSeed} name={user.name} size={86} />
            <div className="min-w-0 pt-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-[#1F1B17]/55 mb-1">
                Your studio
              </div>
              <h2
                id="profile-title"
                className="font-display text-[38px] sm:text-[44px] leading-[1.02] tracking-[-0.02em] font-light truncate"
              >
                {user.name || 'Traveler'}
                <span className="text-[#C96442]">.</span>
              </h2>
              <p className="text-[13px] text-[#1F1B17]/60 mt-1">{user.email}</p>
            </div>
          </header>

          {/* Name */}
          <section className="border-t border-[#1F1B17]/10 pt-8">
            <SectionLabel index="01" title="Name" hint="How we address you." />
            <div className="mt-4 flex items-end gap-3">
              <div className="flex-1">
                <div className="flex items-center border-b border-[#1F1B17]/20 focus-within:border-[#C96442] transition-colors">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-transparent py-2.5 text-[17px] text-[#1F1B17] placeholder:text-[#1F1B17]/30 outline-none font-display font-light"
                    placeholder="Your name"
                    maxLength={120}
                  />
                </div>
              </div>
              <button
                onClick={handleSaveName}
                disabled={!nameChanged || savingName}
                className="px-4 py-2.5 text-[13px] font-medium rounded-full bg-[#1F1B17] text-[#F5EFE6] hover:bg-[#C96442] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingName ? (
                  <span className="w-3.5 h-3.5 border-2 border-[#F5EFE6]/30 border-t-[#F5EFE6] rounded-full animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Save
              </button>
            </div>
          </section>

          {/* Avatar */}
          <section className="border-t border-[#1F1B17]/10 pt-8">
            <SectionLabel
              index="02"
              title="Portrait"
              hint="A generated mark, unique to you."
            />
            <div className="mt-5 flex items-center gap-6">
              <div
                className="rounded-full p-1.5"
                style={{
                  background:
                    'conic-gradient(from 180deg at 50% 50%, #C96442, #6B2E1E, #1F1B17, #C96442)',
                }}
              >
                <Avatar seed={avatarSeed} name={user.name} size={96} />
              </div>
              <div className="flex-1 flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRegenerateAvatar}
                  className="px-4 py-2.5 text-[13px] font-medium rounded-full bg-[#E9DFCF] text-[#1F1B17] hover:bg-[#DBCCB5] transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  Regenerate
                </button>
                <button
                  onClick={handleSaveAvatar}
                  disabled={!avatarChanged || savingAvatar}
                  className="px-4 py-2.5 text-[13px] font-medium rounded-full bg-[#1F1B17] text-[#F5EFE6] hover:bg-[#C96442] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingAvatar ? (
                    <span className="w-3.5 h-3.5 border-2 border-[#F5EFE6]/30 border-t-[#F5EFE6] rounded-full animate-spin" />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                  Save portrait
                </button>
              </div>
            </div>
          </section>

          {/* Danger zone */}
          <section className="border-t border-[#1F1B17]/10 pt-8">
            <SectionLabel
              index="03"
              title="End of the road"
              hint="Irreversible. Everything tied to this account goes with it."
              accent="#8F3A24"
            />

            {deleteMode === 'idle' && (
              <button
                onClick={() => setDeleteMode('confirming')}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-full border border-[#C96442]/40 text-[#8F3A24] hover:bg-[#C96442]/10 transition-colors"
              >
                <AlertTriangle size={14} />
                Delete account
              </button>
            )}

            {deleteMode === 'confirming' && (
              <div className="mt-5 rounded-2xl border border-[#8F3A24]/25 bg-[#F9E7DC] p-5 sm:p-6 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#8F3A24] text-[#F5EFE6] flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-[20px] leading-snug text-[#1F1B17]">
                      This cannot be undone.
                    </h3>
                    <p className="text-[13px] text-[#1F1B17]/70 mt-1 leading-relaxed">
                      All projects, tasks, subtasks, links, and settings will be erased.
                      Type your email{' '}
                      <span className="font-mono bg-[#1F1B17]/5 px-1.5 py-0.5 rounded text-[12px]">
                        {user.email}
                      </span>{' '}
                      to confirm.
                    </p>

                    <input
                      value={deleteText}
                      onChange={(e) => setDeleteText(e.target.value)}
                      autoFocus
                      className="mt-4 w-full bg-[#F5EFE6] border border-[#8F3A24]/30 focus:border-[#8F3A24] outline-none rounded-lg px-3.5 py-2.5 text-[14px] font-mono"
                      placeholder={user.email}
                      aria-label="Type email to confirm"
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleteText !== user.email || deleting}
                        className="px-4 py-2.5 text-[13px] font-medium rounded-full bg-[#8F3A24] text-[#F5EFE6] hover:bg-[#6B2E1E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {deleting && (
                          <span className="w-3.5 h-3.5 border-2 border-[#F5EFE6]/30 border-t-[#F5EFE6] rounded-full animate-spin" />
                        )}
                        Delete everything
                      </button>
                      <button
                        onClick={() => {
                          setDeleteMode('idle');
                          setDeleteText('');
                        }}
                        className="px-4 py-2.5 text-[13px] font-medium rounded-full text-[#1F1B17]/70 hover:text-[#1F1B17] hover:bg-[#1F1B17]/5 transition-colors"
                      >
                        Nevermind
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const SectionLabel: React.FC<{ index: string; title: string; hint?: string; accent?: string }> = ({
  index,
  title,
  hint,
  accent,
}) => (
  <div className="flex items-baseline gap-4">
    <span
      className="text-[11px] font-mono tracking-[0.2em]"
      style={{ color: accent ?? 'rgba(31,27,23,0.5)' }}
    >
      {index}
    </span>
    <div>
      <h3 className="font-display text-[22px] leading-tight font-light" style={{ color: accent ?? '#1F1B17' }}>
        {title}
      </h3>
      {hint && <p className="text-[12px] text-[#1F1B17]/55 mt-0.5">{hint}</p>}
    </div>
  </div>
);

export default ProfilePage;
