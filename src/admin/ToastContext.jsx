import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Icon } from './components/ui';
import s from './admin.module.css';

const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

let seq = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
  }, []);

  const push = useCallback((message, tone = 'default') => {
    const id = ++seq;
    setToasts((list) => [...list.slice(-3), { id, message, tone }]);
    timers.current[id] = setTimeout(() => dismiss(id), tone === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const toast = useCallback((message, tone) => push(message, tone), [push]);
  toast.success = (m) => push(m, 'success');
  toast.error = (m) => push(m, 'error');

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={s.toasts} aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={s.toast} data-tone={t.tone !== 'default' ? t.tone : undefined} role="status">
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" style={{ marginLeft: 'auto', opacity: 0.7 }}>
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
