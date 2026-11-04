import type { AppNotification, NotificationGroup } from "@/types/notification";

/** Connections go under Friends, everything about matches and your level under Matches */
export function notificationGroup(notification: AppNotification): NotificationGroup {
  return notification.kind === "connection_request" || notification.kind === "connection_accepted"
    ? "friends"
    : "matches";
}
