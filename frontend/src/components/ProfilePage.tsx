import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { X, RefreshCw, Check, ArrowRight, AlertTriangle, Download, Upload, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAppState } from '../context/AppState';
import { useToast } from '../context/ToastContext';
import { usePreferences } from '../context/PreferencesContext';
import * as api from '../api/client';
import Avatar, { randomAvatarSeed } from './Avatar';

interface Props {
  onClose: () => void;
}

const ProfilePage: React.FC<Props> = ({ onClose }) => {
  const { user, updateProfile, deleteAccount } = useAuth();
  const { reload } = useAppState();
  const { success, error: toastError } = useToast();
  const { easterEggsEnabled, setEasterEggsEnabled } = usePreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = async () => {
    try {
      const payload = await api.data.export();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `urban-tasks-${format(new Date(), 'yyyy-MM-dd')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      success('Data exported');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!Array.isArray(payload.projects) || !Array.isArray(payload.tasks)) {
        throw new Error('Invalid file format');
      }
      const result = await api.data.import({
        projects: payload.projects,
        tasks: payload.tasks,
      });
      await reload();
      success(`Imported ${result.projectsCreated} projects, ${result.tasksCreated} tasks`);
    } catch (err) {
      toastError('Import failed: ' + (err instanceof Error ? err.message : 'unknown error'));
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

  return createPortal(
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
    >
      <div className="min-h-full flex items-start justify-center p-0 sm:p-6 sm:py-10">
      <div
        className="relative w-full max-w-[min(92vw,1100px)] bg-bg text-text-primary rounded-none sm:rounded-[28px] overflow-hidden border border-border-light shadow-2xl"
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
          className="absolute right-4 top-4 z-10 p-2 rounded-full text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
        >
          <X size={18} />
        </button>

        <div className="relative z-1 px-6 sm:px-10 pt-10 pb-10 space-y-10">
          {/* Header */}
          <header className="flex items-start gap-5">
            <Avatar seed={avatarSeed} name={user.name} size={86} />
            <div className="min-w-0 pt-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-tertiary mb-1">
                Your studio
              </div>
              <h2
                id="profile-title"
                className="font-display text-[38px] sm:text-[44px] leading-[1.02] tracking-[-0.02em] font-light truncate text-text-primary"
              >
                {user.name || 'Traveler'}
                <span className="text-accent">.</span>
              </h2>
              <p className="text-[13px] text-text-secondary mt-1">{user.email}</p>
            </div>
          </header>

          {/* Name */}
          <section className="border-t border-border-light pt-8">
            <SectionLabel index="01" title="Name" hint="How we address you." />
            <div className="mt-4 flex items-end gap-3">
              <div className="flex-1">
                <div className="flex items-center border-b border-border focus-within:border-accent transition-colors">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-transparent py-2.5 text-[17px] text-text-primary placeholder:text-text-tertiary outline-none font-display font-light"
                    placeholder="Your name"
                    maxLength={120}
                  />
                </div>
              </div>
              <button
                onClick={handleSaveName}
                disabled={!nameChanged || savingName}
                className="px-4 py-2.5 text-[13px] font-medium rounded-full bg-text-primary text-text-inverse hover:bg-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {savingName ? (
                  <span className="w-3.5 h-3.5 border-2 border-text-inverse/30 border-t-text-inverse rounded-full animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                Save
              </button>
            </div>
          </section>

          {/* Avatar */}
          <section className="border-t border-border-light pt-8">
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
                  className="px-4 py-2.5 text-[13px] font-medium rounded-full bg-bg-tertiary text-text-primary hover:bg-border-light transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  Regenerate
                </button>
                <button
                  onClick={handleSaveAvatar}
                  disabled={!avatarChanged || savingAvatar}
                  className="px-4 py-2.5 text-[13px] font-medium rounded-full bg-text-primary text-text-inverse hover:bg-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingAvatar ? (
                    <span className="w-3.5 h-3.5 border-2 border-text-inverse/30 border-t-text-inverse rounded-full animate-spin" />
                  ) : (
                    <ArrowRight size={14} />
                  )}
                  Save portrait
                </button>
              </div>
            </div>
          </section>

          {/* Export / Load */}
          <section className="border-t border-border-light pt-8">
            <SectionLabel
              index="03"
              title="Archive & restore"
              hint="Carry your projects and tasks with you, or pour them back in."
            />
            <div className="mt-5 grid sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-bg-secondary border border-border-light p-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary mb-1.5">
                  Export
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
                  A single JSON file with every project and task.
                </p>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-full bg-text-primary text-text-inverse hover:bg-accent transition-colors"
                >
                  <Download size={14} />
                  Download backup
                </button>
              </div>
              <div className="rounded-2xl bg-bg-secondary border border-border-light p-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-text-tertiary mb-1.5">
                  Load
                </div>
                <p className="text-[13px] text-text-secondary leading-relaxed mb-4">
                  Bring in a previous export. Adds to what's already here.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-full bg-bg-tertiary text-text-primary hover:bg-border-light transition-colors"
                >
                  <Upload size={14} />
                  Import file
                </button>
              </div>
            </div>
          </section>

          {/* Preferences */}
          <section className="border-t border-border-light pt-8">
            <SectionLabel
              index="04"
              title="Quiet mode"
              hint="Flourishes, surprises, and hidden corners."
            />
            <div className="mt-5 flex items-center justify-between gap-6 rounded-2xl bg-bg-secondary border border-border-light p-5">
              <div className="min-w-0 flex items-start gap-3">
                <Sparkles size={18} className="text-accent flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[14px] text-text-primary font-medium">Easter eggs</div>
                  <p className="text-[12px] text-text-secondary mt-0.5 leading-relaxed">
                    Small rewards for curious behavior. Turn off if you'd rather keep things strictly practical.
                  </p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={easterEggsEnabled}
                onClick={() => {
                  const next = !easterEggsEnabled;
                  setEasterEggsEnabled(next);
                  success(next ? 'Easter eggs enabled' : 'Easter eggs disabled');
                }}
                className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
                  easterEggsEnabled ? 'bg-accent' : 'bg-border'
                }`}
                aria-label="Toggle easter eggs"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    easterEggsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Danger zone */}
          <section className="border-t border-border-light pt-8">
            <SectionLabel
              index="05"
              title="End of the road"
              hint="Irreversible. Everything tied to this account goes with it."
              danger
            />

            {deleteMode === 'idle' && (
              <button
                onClick={() => setDeleteMode('confirming')}
                className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-full border border-danger/40 text-danger hover:bg-danger-bg transition-colors"
              >
                <AlertTriangle size={14} />
                Delete account
              </button>
            )}

            {deleteMode === 'confirming' && (
              <div className="mt-5 rounded-2xl border border-danger/30 bg-danger-bg p-5 sm:p-6 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-danger text-text-inverse flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-[20px] leading-snug text-text-primary">
                      This cannot be undone.
                    </h3>
                    <p className="text-[13px] text-text-secondary mt-1 leading-relaxed">
                      All projects, tasks, subtasks, links, and settings will be erased.
                      Type your email{' '}
                      <span className="font-mono bg-surface-hover px-1.5 py-0.5 rounded text-[12px] text-text-primary">
                        {user.email}
                      </span>{' '}
                      to confirm.
                    </p>

                    <input
                      value={deleteText}
                      onChange={(e) => setDeleteText(e.target.value)}
                      autoFocus
                      className="mt-4 w-full bg-surface border border-danger/40 focus:border-danger outline-none rounded-lg px-3.5 py-2.5 text-[14px] font-mono text-text-primary"
                      placeholder={user.email}
                      aria-label="Type email to confirm"
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={deleteText !== user.email || deleting}
                        className="px-4 py-2.5 text-[13px] font-medium rounded-full bg-danger text-text-inverse hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {deleting && (
                          <span className="w-3.5 h-3.5 border-2 border-text-inverse/30 border-t-text-inverse rounded-full animate-spin" />
                        )}
                        Delete everything
                      </button>
                      <button
                        onClick={() => {
                          setDeleteMode('idle');
                          setDeleteText('');
                        }}
                        className="px-4 py-2.5 text-[13px] font-medium rounded-full text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
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
    </div>,
    document.body
  );
};

const SectionLabel: React.FC<{ index: string; title: string; hint?: string; danger?: boolean }> = ({
  index,
  title,
  hint,
  danger,
}) => (
  <div className="flex items-baseline gap-4">
    <span className={`text-[11px] font-mono tracking-[0.2em] ${danger ? 'text-danger' : 'text-text-tertiary'}`}>
      {index}
    </span>
    <div>
      <h3 className={`font-display text-[22px] leading-tight font-light ${danger ? 'text-danger' : 'text-text-primary'}`}>
        {title}
      </h3>
      {hint && <p className="text-[12px] text-text-tertiary mt-0.5">{hint}</p>}
    </div>
  </div>
);

export default ProfilePage;
