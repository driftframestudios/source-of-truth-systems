import './notifications.css';
import { createContext, useContext, useCallback, useMemo, useReducer, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, AlertOctagon, Info, X, ShieldAlert } from 'lucide-react';
import type { AppNotification, ErrorSeverity, AppError, NotificationKind } from '../types';
import { createNotificationState, reduceNotifications, nextNotificationDeadline, notificationDisplay, NOTIFICATION_LIMITS } from './notificationState';
import type { NotificationPreferences, NotificationRecord } from './notificationState';

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

const SEVERITY_ICONS = { info: Info, warning: AlertTriangle, error: AlertOctagon, critical: ShieldAlert };
function SeverityIcon({ severity, size = 14 }: { severity: ErrorSeverity; size?: number }) {
  const Icon = SEVERITY_ICONS[severity];
  return <Icon size={size} className="notification-ink" aria-hidden="true" />;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [{ notifications, preferences, omitted }, dispatch] = useReducer(reduceNotifications, undefined, createNotificationState);

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
      <NotificationOverlay notifications={notifications} omitted={omitted} dismiss={dismiss} clearAll={clearAll} />
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}

function NotificationOverlay({ notifications, omitted, dismiss, clearAll }: {
  notifications: ReadonlyArray<NotificationRecord>;
  omitted: number;
  dismiss: (id: string) => void;
  clearAll: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const { banners, toasts } = notificationDisplay(notifications);
  const hidden = notifications.length - banners.length - toasts.length;
  return <>
    {!reviewOpen && banners.length > 0 && <div className="notification-banners">
      {banners.map(n => <NotificationItem key={n.id} n={n} presentation="banner" dismiss={dismiss} />)}
    </div>}
    <div className="notification-dock">
      {!reviewOpen && <div className="notification-toasts">
        {toasts.map(n => <NotificationItem key={n.id} n={n} presentation="toast" dismiss={dismiss} />)}
      </div>}
      {(reviewOpen || hidden > 0 || omitted > 0) && <details className="notification-review" open={reviewOpen}
        onToggle={e => setReviewOpen(e.currentTarget.open)}>
        <summary>Recent feedback ({notifications.length})</summary>
        <section aria-label="Recent feedback" onKeyDown={e => {
          if (e.key === 'Escape') { setReviewOpen(false); e.currentTarget.parentElement?.querySelector('summary')?.focus(); }
        }}>
          <div className="notification-review__rail">
            <p>Up to {NOTIFICATION_LIMITS.retained} recent messages. New feedback replaces older details when full.</p>
            <button onClick={clearAll}>Clear feedback</button>
          </div>
          {omitted > 0 && <p className="notification-review__omitted" role="status">Capacity limit: {formatCount(omitted)} message details omitted.</p>}
          <div className="notification-review__list">
            {[...notifications].reverse().map(n => <NotificationItem key={n.id} n={n} presentation="history" dismiss={dismiss} />)}
            {notifications.length === 0 && <p className="notification-review__empty">Feedback is clear.</p>}
          </div>
        </section>
      </details>}
    </div>
  </>;
}
function formatCount(count: number) { return count >= NOTIFICATION_LIMITS.counter ? `${count}+` : String(count); }
function NotificationItem({ n, presentation, dismiss }: {
  n: NotificationRecord; presentation: 'toast' | 'banner' | 'history'; dismiss: (id: string) => void;
}) {
  return <article className={`notification-item notification-item--${presentation}`} data-severity={n.severity}
    role={presentation === 'history' ? undefined : n.severity === 'critical' || n.severity === 'error' ? 'alert' : 'status'} aria-label={n.title}>
    <SeverityIcon severity={n.severity} />
    <div className="notification-item__body">
      <span className="notification-title">{n.title}</span>
      {n.occurrences > 1 && <span className="notification-repeat" aria-label={`${formatCount(n.occurrences)} occurrences`}>×{formatCount(n.occurrences)}</span>}
      <span className="notification-message">{n.message}</span>
      {n.errorRef && presentation !== 'banner' && <span className="notification-reference">ref: {n.errorRef}</span>}
    </div>
    <button onClick={() => dismiss(n.id)} className="notification-dismiss" aria-label={`Dismiss ${n.title}`}><X size={12} /></button>
  </article>;
}
