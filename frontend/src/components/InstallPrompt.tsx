import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISSED_KEY = 'urban-tasks:install-dismissed';

const InstallPrompt: React.FC = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setDeferred(null);
      setVisible(false);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setVisible(false);
  };

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[55] max-w-sm bg-bg border border-border rounded-xl shadow-lg p-4 animate-in slide-in-from-bottom-4 fade-in">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent-light flex items-center justify-center flex-shrink-0">
          <Download size={18} className="text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-text-primary">Install Urban Tasks</p>
          <p className="text-[12px] text-text-tertiary">Run it as an app with offline support.</p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md bg-accent text-text-inverse hover:bg-accent-hover transition-base"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md text-text-secondary hover:bg-surface-hover transition-base"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded text-text-tertiary hover:text-text-primary transition-base"
          aria-label="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default InstallPrompt;
