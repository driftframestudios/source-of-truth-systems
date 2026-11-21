import './notifications.css';
import { createContext, useContext, useCallback, useMemo, useReducer, useEffect, useState, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { LoadBoundary } from '../components/DeferredView';
import type { AppNotification, ErrorSeverity, AppError, NotificationKind } from '../types';
import { createNotificationState, reduceNotifications, nextNotificationDeadline } from './notificationState';
import type { NotificationPreferences } from './notificationState';

interface NotificationContextValue {
  readonly notifications: ReadonlyArray<AppNotification>;
  readonly preferences: NotificationPreferences;
  setInformationalToasts: (enabled: boolean) => void;
  resetPreferences: () => void;
  pushToast: (n: { severity: ErrorSeverity; title: string; message: string; errorRef?: string; persistent?: boolean }) => void;
  pushBanner: (n: { severity: ErrorSeverity; title: string; message: string; errorRef?: string }) => void;
  pushFromError: (err: AppError, kind?: NotificationKind) => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

function rid(): string {
  return `n_${Math.random().toString(36).slice(2, 10)}`;
}

const NotificationOverlay = lazy(() => import('./NotificationOverlay'));

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [{ notifications, preferences, omitted }, dispatch] = useReducer(reduceNotifications, undefined, createNotificationState);

  const [feedbackStarted, setFeedbackStarted] = useState(false);
  const hasFeedback = notifications.length > 0 || omitted > 0;
  useEffect(() => { if (hasFeedback) setFeedbackStarted(true); }, [hasFeedback]);
  const deadline = nextNotificationDeadline(notifications);
  useEffect(() => {
    if (deadline === null) return;
    const expire = () => dispatch({ type: 'expire', now: Date.now() });
    const timer = setTimeout(expire, Math.max(0, deadline - Date.now()));
    const resume = () => { if (document.visibilityState === 'visible') expire(); };
    document.addEventListener('visibilitychange', resume);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', resume); };
  }, [deadline]);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'dismiss', id });
  }, []);

  const push = useCallback(
    (kind: NotificationKind, severity: ErrorSeverity, title: string, message: string, persistent: boolean, errorRef?: string) => {
      const n: AppNotification = { id: rid(), kind, severity, title, message, persistent, createdAt: Date.now(), errorRef };
      dispatch({ type: 'push', notification: n });
    },
    [],
  );

  const pushToast: NotificationContextValue['pushToast'] = useCallback(
    ({ severity, title, message, errorRef, persistent }) => push('toast', severity, title, message, persistent ?? false, errorRef),
    [push],
  );
  const pushBanner: NotificationContextValue['pushBanner'] = useCallback(
    ({ severity, title, message, errorRef }) => push('banner', severity, title, message, true, errorRef),
    [push],
  );
  const pushFromError: NotificationContextValue['pushFromError'] = useCallback(
    (err, kind = 'toast') => push(kind, err.severity, err.title, err.message, kind === 'banner', err.id),
    [push],
  );
  const clearAll = useCallback(() => dispatch({ type: 'clear' }), []);
  const setInformationalToasts = useCallback((enabled: boolean) => dispatch({ type: 'informational-toasts', enabled }), []);
  const resetPreferences = useCallback(() => dispatch({ type: 'reset-preferences' }), []);

  const value: NotificationContextValue = useMemo(
    () => ({ notifications, preferences, setInformationalToasts, resetPreferences, pushToast, pushBanner, pushFromError, dismiss, clearAll }),
    [notifications, preferences, setInformationalToasts, resetPreferences, pushToast, pushBanner, pushFromError, dismiss, clearAll],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      {(hasFeedback || feedbackStarted) && <LoadBoundary label="feedback controls" fallback={hasFeedback &&
        <section className="notification-fallback" aria-label="Recent feedback">
          <p>Feedback controls couldn’t load. Your messages remain available here.</p>
          {notifications.map(n => <p key={n.id}><strong>{n.title}</strong> · {n.message} {n.errorRef && <span>ref: {n.errorRef}</span>} <button aria-label={`Dismiss ${n.title}`} onClick={() => dismiss(n.id)}>Dismiss</button></p>)}
          {omitted > 0 && <p>Capacity limit: {omitted} message details omitted.</p>}
          <button onClick={clearAll}>Clear feedback</button>
        </section>
      }><Suspense fallback={<div className="notification-loading" role="status">Opening feedback…</div>}>
        <NotificationOverlay notifications={notifications} omitted={omitted} dismiss={dismiss} clearAll={clearAll} />
      </Suspense></LoadBoundary>}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}

