import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const mod = isMac ? '⌘' : 'Ctrl';

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: [`${mod}`, 'K'], label: 'Open command palette' },
  { keys: ['N'], label: 'Add task' },
  { keys: [`${mod}`, 'Z'], label: 'Undo last task edit' },
  { keys: [`${mod}`, 'Shift', 'Z'], label: 'Redo' },
  { keys: ['?'], label: 'Show this shortcuts help' },
  { keys: ['Esc'], label: 'Close overlay / deselect' },
];

const ShortcutsHelp: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 animate-fade-in p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard size={16} className="text-text-tertiary" />
            <h3 className="text-[14px] font-semibold text-text-primary">Keyboard shortcuts</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span className="text-[13px] text-text-secondary">{label}</span>
              <div className="flex items-center gap-1">
                {keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-1.5 py-0.5 text-2xs font-mono bg-bg-secondary border border-border rounded text-text-secondary"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShortcutsHelp;
