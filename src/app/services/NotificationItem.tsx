import { AlertTriangle, AlertOctagon, Info, X, ShieldAlert } from 'lucide-react';
import type { ErrorSeverity } from '../types';
import { NOTIFICATION_LIMITS } from './notificationState';
import type { NotificationRecord } from './notificationState';

const SEVERITY_ICONS = { info: Info, warning: AlertTriangle, error: AlertOctagon, critical: ShieldAlert };
function SeverityIcon({ severity, size = 14 }: { severity: ErrorSeverity; size?: number }) {
  const Icon = SEVERITY_ICONS[severity];
  return <Icon size={size} className="notification-ink" aria-hidden="true" />;
}

export function formatCount(count: number) { return count >= NOTIFICATION_LIMITS.counter ? `${count}+` : String(count); }
export function NotificationItem({ n, presentation, dismiss }: {
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
