import { NotificationItem, formatCount } from './NotificationItem';
import { NOTIFICATION_LIMITS } from './notificationState';
import type { NotificationRecord } from './notificationState';

/** The detail panel loads on demand; admission and deadlines stay in the mounted provider. */
export default function NotificationFeedback({ notifications, omitted, dismiss, clearAll, close }: {
  notifications: ReadonlyArray<NotificationRecord>; omitted: number;
  dismiss: (id: string) => void; clearAll: () => void; close: () => void;
}) {
  return <section aria-label="Recent feedback" onKeyDown={e => {
    if (e.key === 'Escape') { close(); e.currentTarget.parentElement?.querySelector('summary')?.focus(); }
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
  </section>;
}
