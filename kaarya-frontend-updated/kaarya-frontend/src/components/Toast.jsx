import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext({ notify: () => {} });

export const useToast = () => useContext(ToastContext);

const ICONS = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const STYLES = {
  error: 'border-red-200 text-red-800',
  success: 'border-emerald-200 text-emerald-800',
  info: 'border-line-strong text-ink-700',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (message, kind = 'info') => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((list) => [...list, { id, message, kind }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => {
          const Icon = ICONS[t.kind] || Info;
          return (
            <div
              key={t.id}
              role="status"
              className={`flex animate-rise items-start gap-2.5 rounded-lg border bg-white
                          px-3.5 py-3 text-sm shadow-pop ${STYLES[t.kind] || STYLES.info}`}
            >
              <Icon size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="text-ink-300 hover:text-ink-700"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
