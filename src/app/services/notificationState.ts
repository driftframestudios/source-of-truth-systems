import type { AppNotification } from "../types";

export interface NotificationPreferences {
  readonly informationalToasts: boolean;
}
export interface NotificationState {
  readonly preferences: NotificationPreferences;
  readonly notifications: ReadonlyArray<AppNotification>;
}
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences =
  Object.freeze({ informationalToasts: true });
export type NotificationEvent =
  | { readonly type: "push"; readonly notification: AppNotification }
  | { readonly type: "dismiss"; readonly id: string }
  | { readonly type: "clear" }
  | { readonly type: "informational-toasts"; readonly enabled: boolean }
  | { readonly type: "reset-preferences" };

export function createNotificationState(): NotificationState {
  return { preferences: DEFAULT_NOTIFICATION_PREFERENCES, notifications: [] };
}

/** Preferences quiet optional information while preserving feedback that needs attention. */
export function acceptsNotification(
  preferences: NotificationPreferences,
  notification: AppNotification,
): boolean {
  return (
    notification.kind === "banner" ||
    notification.severity !== "info" ||
    notification.persistent ||
    Boolean(notification.errorRef) ||
    preferences.informationalToasts
  );
}

export function reduceNotifications(
  state: NotificationState,
  event: NotificationEvent,
): NotificationState {
  switch (event.type) {
    case "push":
      return acceptsNotification(state.preferences, event.notification)
        ? {
            ...state,
            notifications: [...state.notifications, event.notification],
          }
        : state;
    case "dismiss":
      return {
        ...state,
        notifications: state.notifications.filter(
          (notification) => notification.id !== event.id,
        ),
      };
    case "clear":
      return { ...state, notifications: [] };
    case "informational-toasts": {
      if (
        typeof event.enabled !== "boolean" ||
        event.enabled === state.preferences.informationalToasts
      )
        return state;
      const preferences = { informationalToasts: event.enabled };
      return {
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
