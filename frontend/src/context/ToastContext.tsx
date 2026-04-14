import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  position: ToastPosition;
}

interface ToastOptions {
  type?: ToastType;
  position?: ToastPosition;
  durationMs?: number;
}

interface ToastContextValue {
  toast: (message: string, options?: ToastOptions) => void;
  success: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  error: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
  info: (message: string, options?: Omit<ToastOptions, 'type'>) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_TTL_MS = 4000;

const CONTAINER_CLASS: Record<ToastPosition, string> = {
  'top-left': 'top-4 left-4 items-start',
  'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
  'top-right': 'top-4 right-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
  'bottom-right': 'bottom-4 right-4 items-end',
};

const ANIM_CLASS: Record<ToastPosition, string> = {
  'top-left': 'animate-slide-in-left',
  'top-center': 'animate-slide-in-top',
  'top-right': 'animate-slide-in-right',
  'bottom-left': 'animate-slide-in-left',
  'bottom-center': 'animate-slide-in-bottom',
  'bottom-right': 'animate-slide-in-right',
};

interface ProviderProps {
  children: React.ReactNode;
  defaultPosition?: ToastPosition;
}

export const ToastProvider: React.FC<ProviderProps> = ({
  children,
  defaultPosition = 'bottom-right',
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, options?: ToastOptions) => {
      const id = nextId.current++;
      const type = options?.type ?? 'info';
      const position = options?.position ?? defaultPosition;
      const ttl = options?.durationMs ?? DEFAULT_TTL_MS;
      setToasts((prev) => [...prev, { id, type, message, position }]);
      if (ttl > 0) window.setTimeout(() => remove(id), ttl);
    },
    [defaultPosition, remove]
  );

  const value: ToastContextValue = useMemo(
    () => ({
      toast,
      success: (m, o) => toast(m, { ...o, type: 'success' }),
      error: (m, o) => toast(m, { ...o, type: 'error' }),
      info: (m, o) => toast(m, { ...o, type: 'info' }),
    }),
    [toast]
  );

  // Group toasts by position so each edge has its own stack.
  const grouped = useMemo(() => {
    const map = new Map<ToastPosition, Toast[]>();
    for (const t of toasts) {
      const list = map.get(t.position) ?? [];
      list.push(t);
      map.set(t.position, list);
    }
    return map;
  }, [toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {Array.from(grouped.entries()).map(([position, items]) => (
        <div
          key={position}
          className={`fixed z-[80] flex flex-col gap-2 pointer-events-none max-w-sm w-[calc(100%-2rem)] sm:w-auto sm:min-w-[260px] ${CONTAINER_CLASS[position]} ${
            position.startsWith('bottom') ? 'flex-col-reverse' : ''
          }`}
        >
          {items.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => remove(t.id)} />
          ))}
        </div>
      ))}
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const Icon =
    toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info;

  const colorClass =
    toast.type === 'success'
      ? 'text-status-active'
      : toast.type === 'error'
        ? 'text-danger'
        : 'text-accent';

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 bg-surface border border-border rounded-lg shadow-lg px-4 py-3 ${ANIM_CLASS[toast.position]}`}
    >
      <Icon size={18} className={`${colorClass} flex-shrink-0 mt-0.5`} />
      <p className="flex-1 text-[13px] text-text-primary leading-relaxed">{toast.message}</p>
      <button
        onClick={onDismiss}
        className="p-0.5 text-text-tertiary hover:text-text-primary transition-base flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
