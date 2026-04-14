import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<Props> = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}) => {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 animate-fade-in p-4"
      onClick={onCancel}
    >
      <div
        className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="flex items-start gap-3">
          {danger && (
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-danger-bg flex items-center justify-center">
              <AlertTriangle size={18} className="text-danger" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 id="confirm-dialog-title" className="text-[15px] font-semibold text-text-primary">{title}</h3>
            <p id="confirm-dialog-message" className="text-[13px] text-text-secondary mt-1 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3.5 py-2 text-[13px] text-text-secondary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-base"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-3.5 py-2 text-[13px] font-medium rounded-lg transition-base ${
              danger
                ? 'bg-danger text-white hover:bg-danger/90'
                : 'bg-accent text-text-inverse hover:bg-accent-hover'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
