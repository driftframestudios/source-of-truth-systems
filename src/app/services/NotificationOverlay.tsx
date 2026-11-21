import { useState } from 'react';
import { notificationDisplay } from './notificationState';
import type { NotificationRecord } from './notificationState';
import { NotificationItem } from './NotificationItem';
import NotificationFeedback from './NotificationFeedback';

export default function NotificationOverlay({ notifications, omitted, dismiss, clearAll }: {
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
        {reviewOpen && <>
          <NotificationFeedback notifications={notifications} omitted={omitted} dismiss={dismiss} clearAll={clearAll}
            close={() => setReviewOpen(false)} />
        </>}
      </details>}
    </div>
  </>;
}
