import type { AppNotification } from "../types";

export interface NotificationPreferences {
  readonly informationalToasts: boolean;
}
export const NOTIFICATION_LIMITS = Object.freeze({
  toastMs: 5000,
  visibleToasts: 3,
  visibleBanners: 1,
  retained: 50,
  counter: 9999,
});
export interface NotificationRecord extends AppNotification {
  readonly occurrences: number;
  readonly active: boolean;
}
export interface NotificationState {
  readonly preferences: NotificationPreferences;
  readonly notifications: ReadonlyArray<NotificationRecord>;
  readonly omitted: number;
}
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences =
  Object.freeze({ informationalToasts: true });
export type NotificationEvent =
  | { readonly type: "push"; readonly notification: AppNotification }
  | { readonly type: "dismiss"; readonly id: string }
  | { readonly type: "clear" }
  | { readonly type: "expire"; readonly now: number }
  | { readonly type: "informational-toasts"; readonly enabled: boolean }
  | { readonly type: "reset-preferences" };

export function createNotificationState(): NotificationState {
  return {
    preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    notifications: [],
    omitted: 0,
  };
}

/** Attention-bearing feedback remains reviewable after its transient presentation ends. */
export function requiresAttention(notification: AppNotification): boolean {
  return (
    notification.kind === "banner" ||
    notification.severity !== "info" ||
    notification.persistent ||
    Boolean(notification.errorRef)
  );
}
export function acceptsNotification(
  preferences: NotificationPreferences,
  notification: AppNotification,
): boolean {
  return requiresAttention(notification) || preferences.informationalToasts;
}
export function notificationDeadline(
  notification: AppNotification,
): number | null {
  return notification.persistent || notification.kind === "banner"
    ? null
    : notification.createdAt + NOTIFICATION_LIMITS.toastMs;
}
export function nextNotificationDeadline(
  notifications: ReadonlyArray<NotificationRecord>,
): number | null {
  let next: number | null = null;
  for (const record of notifications) {
    const deadline = record.active ? notificationDeadline(record) : null;
    if (deadline !== null && (next === null || deadline < next))
      next = deadline;
  }
  return next;
}
export function notificationDisplay(
  notifications: ReadonlyArray<NotificationRecord>,
) {
  const active = notifications.filter((record) => record.active);
  return {
    toasts: active
      .filter((record) => record.kind === "toast")
      .slice(-NOTIFICATION_LIMITS.visibleToasts),
    banners: active
      .filter((record) => record.kind === "banner")
      .slice(-NOTIFICATION_LIMITS.visibleBanners),
  };
}
const increment = (count: number) =>
  Math.min(count + 1, NOTIFICATION_LIMITS.counter);
const sameFeedback = (a: AppNotification, b: AppNotification) =>
  a.kind === b.kind &&
  a.severity === b.severity &&
  a.title === b.title &&
  a.message === b.message &&
  a.persistent === b.persistent &&
  a.errorRef === b.errorRef;

function expire(state: NotificationState, now: number): NotificationState {
  let changed = false;
  const notifications = state.notifications.flatMap((record) => {
    const deadline = notificationDeadline(record);
    if (!record.active || deadline === null || deadline > now) return [record];
    changed = true;
    return requiresAttention(record) ? [{ ...record, active: false }] : [];
  });
  return changed ? { ...state, notifications } : state;
}

export function reduceNotifications(
  state: NotificationState,
  event: NotificationEvent,
): NotificationState {
  switch (event.type) {
    case "push": {
      const incoming = event.notification;
      if (!acceptsNotification(state.preferences, incoming)) return state;
      const settled = expire(state, incoming.createdAt);
      const duplicate = settled.notifications.find(
        (record) => record.active && sameFeedback(record, incoming),
      );
      if (duplicate)
        return {
          ...settled,
          notifications: [
            ...settled.notifications.filter((record) => record !== duplicate),
            { ...duplicate, occurrences: increment(duplicate.occurrences) },
          ],
        };
      const notifications = [...settled.notifications];
      let omitted = settled.omitted;
      if (notifications.length >= NOTIFICATION_LIMITS.retained) {
        const ordinary = notifications.filter(
          (record) => !requiresAttention(record),
        );
        omitted = increment(omitted);
        // Optional incoming information yields capacity to retained attention-bearing feedback.
        if (!ordinary.length && !requiresAttention(incoming))
          return { ...settled, omitted };
        const candidates = ordinary.length ? ordinary : notifications;
        const oldest = candidates.reduce((oldest, record) =>
          record.createdAt < oldest.createdAt ? record : oldest,
        );
        notifications.splice(notifications.indexOf(oldest), 1);
      }
      notifications.push({ ...incoming, occurrences: 1, active: true });
      return { ...settled, notifications, omitted };
    }
    case "expire":
      return expire(state, event.now);
    case "dismiss":
      return {
        ...state,
        notifications: state.notifications.filter(
          (notification) => notification.id !== event.id,
        ),
      };
    case "clear":
      return { ...state, notifications: [], omitted: 0 };
    case "informational-toasts": {
      if (
        typeof event.enabled !== "boolean" ||
        event.enabled === state.preferences.informationalToasts
      )
        return state;
      const preferences = { informationalToasts: event.enabled };
      return {
        ...state,
        preferences,
        notifications: state.notifications.filter((notification) =>
          acceptsNotification(preferences, notification),
        ),
      };
    }
    case "reset-preferences":
      return { ...state, preferences: DEFAULT_NOTIFICATION_PREFERENCES };
  }
}
