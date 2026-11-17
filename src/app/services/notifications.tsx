import { createContext, useContext, useCallback, useMemo, useReducer, useEffect } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, AlertOctagon, Info, X, ShieldAlert } from 'lucide-react';
import type { AppNotification, ErrorSeverity, AppError, NotificationKind } from '../types';
import { createNotificationState, reduceNotifications } from './notificationState';
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

const SEVERITY_STYLES: Record<ErrorSeverity, { fg: string; bg: string; border: string; ring: string }> = {
  info:     { fg: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.30)', ring: 'rgba(96,165,250,0.50)' },
  warning:  { fg: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.32)', ring: 'rgba(245,158,11,0.50)' },
  error:    { fg: '#f87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.34)', ring: 'rgba(248,113,113,0.55)' },
  critical: { fg: '#fb7185', bg: 'rgba(251,113,133,0.12)', border: 'rgba(251,113,133,0.45)', ring: 'rgba(251,113,133,0.65)' },
};

function SeverityIcon({ severity, size = 14 }: { severity: ErrorSeverity; size?: number }) {
  const color = SEVERITY_STYLES[severity].fg;
  switch (severity) {
    case 'info':     return <Info size={size} style={{ color }} />;
    case 'warning':  return <AlertTriangle size={size} style={{ color }} />;
    case 'error':    return <AlertOctagon size={size} style={{ color }} />;
    case 'critical': return <ShieldAlert size={size} style={{ color }} />;
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [{ notifications, preferences }, dispatch] = useReducer(reduceNotifications, undefined, createNotificationState);

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
      <NotificationOverlay notifications={notifications} dismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}

function NotificationOverlay({
  notifications,
  dismiss,
}: {
  notifications: ReadonlyArray<AppNotification>;
  dismiss: (id: string) => void;
}) {
  const banners = notifications.filter((n) => n.kind === 'banner');
  const toasts = notifications.filter((n) => n.kind === 'toast');
  return (
    <>
      {banners.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-50 flex flex-col gap-px pointer-events-none">
          {banners.map((b) => (
            <BannerItem key={b.id} n={b} onDismiss={() => dismiss(b.id)} />
          ))}
        </div>
      )}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none" style={{ maxWidth: 'min(24rem, calc(100vw - 2rem))' }}>
        {toasts.map((t) => (
          <ToastItem key={t.id} n={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </>
  );
}

function BannerItem({ n, onDismiss }: { n: AppNotification; onDismiss: () => void }) {
  const s = SEVERITY_STYLES[n.severity];
  return (
    <div
      className="pointer-events-auto flex items-center gap-3 px-5 py-2 border-b"
      style={{ backgroundColor: s.bg, borderColor: s.border, backdropFilter: 'blur(8px)' }}
    >
      <SeverityIcon severity={n.severity} />
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-mono" style={{ color: s.fg }}>{n.title}</span>
        <span className="text-[11px] text-[var(--sot-shell-text)] ml-2">{n.message}</span>
      </div>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
        <X size={12} style={{ color: s.fg }} />
      </button>
    </div>
  );
}

function ToastItem({ n, onDismiss }: { n: AppNotification; onDismiss: () => void }) {
  const s = SEVERITY_STYLES[n.severity];
  useEffect(() => {
    if (n.persistent) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [n.persistent, onDismiss]);
  return (
    <div
      className="pointer-events-auto rounded border p-3 flex items-start gap-2.5 shadow-lg animate-in slide-in-from-right"
      style={{ backgroundColor: 'var(--sot-shell-surface)', borderColor: s.border, boxShadow: `0 0 0 1px color-mix(in srgb, ${s.ring} 20.000%, transparent), 0 12px 30px -10px ${s.ring}` }}
    >
      <SeverityIcon severity={n.severity} />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-mono" style={{ color: s.fg }}>{n.title}</div>
        <div className="text-[10px] text-[var(--sot-shell-text)] leading-relaxed mt-0.5">{n.message}</div>
        {n.errorRef && <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-1">ref: {n.errorRef}</div>}
      </div>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 -mt-0.5">
        <X size={12} className="text-[var(--sot-shell-muted)]" />
      </button>
    </div>
  );
}
