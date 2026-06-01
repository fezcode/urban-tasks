import React from 'react';
import { Sparkles, Command, Keyboard, Bell, X } from 'lucide-react';

interface Props {
  onClose: () => void;
  onEnableNotifications: () => void;
  notificationsSupported: boolean;
}

const Onboarding: React.FC<Props> = ({ onClose, onEnableNotifications, notificationsSupported }) => {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bg rounded-2xl border border-border shadow-2xl p-6 sm:p-8 animate-in slide-in-from-bottom-4 fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
              <Sparkles size={20} className="text-accent" />
            </div>
            <div>
              <h2 id="onboarding-title" className="text-[17px] font-semibold text-text-primary">Welcome to Urban Tasks</h2>
              <p className="text-[12px] text-text-tertiary">A quick tour in 30 seconds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Command size={16} className="text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] text-text-primary font-medium">Command palette</p>
              <p className="text-[12px] text-text-tertiary">
                Press{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono">
                  Ctrl/⌘+K
                </kbd>{' '}
                to jump to any task, project, or view.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Keyboard size={16} className="text-accent mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] text-text-primary font-medium">Keyboard shortcuts</p>
              <p className="text-[12px] text-text-tertiary">
                Press{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono">
                  ?
                </kbd>{' '}
                to see all shortcuts. Press{' '}
                <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono">
                  n
                </kbd>{' '}
                to add a task.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Bell size={16} className="text-accent mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] text-text-primary font-medium">Due-date reminders</p>
              <p className="text-[12px] text-text-tertiary">
                Get browser notifications when tasks are due or overdue.
              </p>
              {notificationsSupported && (
                <button
                  onClick={onEnableNotifications}
                  className="mt-2 px-3 py-1.5 text-[12px] font-medium rounded-lg bg-accent text-text-inverse hover:bg-accent-hover transition-base"
                >
                  Enable notifications
                </button>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full py-2.5 text-[13px] font-medium rounded-lg bg-surface hover:bg-surface-hover text-text-primary transition-base border border-border"
        >
          Get started
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
