import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import type { AppNotification, NotificationKind } from "@/types/notification";

// How long to wait before reconnecting after the live connection fails
const RECONNECT_DELAY_MS = 5_000;

type NotificationRow = {
  id: string;
  kind: NotificationKind;
  created_at: string;
  read_at: string | null;
  params: { count?: number };
  url: string;
  match_id: string | null;
  actor_id: string | null;
  actor_first_name: string | null;
  actor_last_name: string | null;
  actor_avatar_url: string | null;
  starts_at: string | null;
  club_name: string | null;
};

function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    kind: row.kind,
    createdAt: new Date(row.created_at),
    isRead: row.read_at !== null,
    player:
      row.actor_id && row.actor_first_name
        ? {
            id: row.actor_id,
            firstName: row.actor_first_name,
            lastName: row.actor_last_name ?? "",
            avatarUrl: row.actor_avatar_url ?? undefined,
          }
        : undefined,
    url: row.url,
    matchId: row.match_id ?? undefined,
    startsAt: row.starts_at ? new Date(row.starts_at) : undefined,
    clubName: row.club_name ?? undefined,
    count: row.params.count,
  };
}

// How many notifications each page loads
export const NOTIFICATIONS_PAGE_SIZE = 20;

export type NotificationFilter = "matches" | "friends";

export type NotificationsPage = {
  items: AppNotification[];
  /** Pass as `before` to load the next page; missing on the last page */
  nextBefore?: string;
};

/** One page of your notifications from the last 60 days, newest first. */
export async function fetchNotificationsPage(
  group: NotificationFilter | undefined,
  before: string | undefined,
): Promise<NotificationsPage> {
  const { data, error } = await supabase.rpc("my_notifications", {
    p_limit: NOTIFICATIONS_PAGE_SIZE,
    p_before: before ?? null,
    p_group: group ?? null,
  });
  if (error) throw error;
  const rows = data as NotificationRow[];
  return {
    items: rows.map(toNotification),
    // A full page means there may be more
    nextBefore: rows.length === NOTIFICATIONS_PAGE_SIZE ? rows[rows.length - 1].created_at : undefined,
  };
}

export type UnreadCounts = Record<NotificationFilter, number>;

export async function fetchUnreadCounts(): Promise<UnreadCounts> {
  const { data, error } = await supabase.rpc("my_unread_notification_counts");
  if (error) throw error;
  const row = (data as { matches: number; friends: number }[])[0];
  return { matches: row?.matches ?? 0, friends: row?.friends ?? 0 };
}

export async function markNotificationsRead(ids: string[]) {
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids });
  if (error) throw error;
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw error;
}

/** Calls `onChange` when one of your notifications is added or read; returns a function that stops listening. */
export function subscribeToNotificationChanges(onChange: () => void) {
  let channel: RealtimeChannel | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;

  function connect() {
    channel = supabase
      .channel("notification-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => onChange())
      .subscribe((status) => {
        if (isStopped) return;
        if (status === "SUBSCRIBED") onChange();
        // A failed channel doesn't recover by itself: drop it and connect again shortly
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          supabase.removeChannel(channel!);
          retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });
  }

  connect();

  return () => {
    isStopped = true;
    clearTimeout(retryTimer);
    if (channel) supabase.removeChannel(channel);
  };
}
