import { useInfiniteQuery, useMutation, useQuery, type InfiniteData } from "@tanstack/react-query";
import { useEffect } from "react";

import { notificationGroup } from "@/lib/notification-group";
import { queryClient } from "@/lib/query-client";
import { onSignedInChange } from "@/repositories/auth-repository";
import {
  fetchNotificationsPage,
  fetchUnreadCounts,
  markAllNotificationsRead,
  markNotificationsRead,
  subscribeToNotificationChanges,
  type NotificationFilter,
  type NotificationsPage,
  type UnreadCounts,
} from "@/repositories/notification-list-repository";
import type { AppNotification } from "@/types/notification";

export const notificationsKey = ["notifications"] as const;
const countsKey = [...notificationsKey, "counts"] as const;

type Pages = InfiniteData<NotificationsPage, string | undefined>;

/** The newest notifications, a page at a time; `fetchNextPage` loads older ones. */
export function useNotifications(group?: NotificationFilter) {
  return useInfiniteQuery({
    queryKey: [...notificationsKey, "list", group ?? "all"],
    queryFn: ({ pageParam }) => fetchNotificationsPage(group, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextBefore,
    // A chat row moves to the top when it grows, so it can show up on two pages; keep the first
    select: (data) => {
      const seen = new Set<string>();
      return data.pages
        .flatMap((page) => page.items)
        .filter((n) => !seen.has(n.id) && !!seen.add(n.id));
    },
  });
}

/** Unread rows per tab, counted by the database so it doesn't depend on what's loaded. */
export function useUnreadCounts() {
  return useQuery({ queryKey: countsKey, queryFn: fetchUnreadCounts });
}

/** How many notifications you haven't read, for the dot on the Home bell. */
export function useUnreadNotificationCount() {
  const { data } = useUnreadCounts();
  return data ? data.matches + data.friends : 0;
}

/** Marks rows read right away; a failed save puts them back. */
function useMarkRead<Variables>(
  mutationFn: (variables: Variables) => Promise<void>,
  isAffected: (notification: AppNotification, variables: Variables) => boolean,
  affectedCounts: (counts: UnreadCounts, variables: Variables) => UnreadCounts,
) {
  return useMutation({
    mutationFn,
    onMutate: async (variables: Variables) => {
      await queryClient.cancelQueries({ queryKey: notificationsKey });
      const previous = queryClient.getQueriesData({ queryKey: notificationsKey });
      queryClient.setQueriesData<Pages>({ queryKey: [...notificationsKey, "list"] }, (current) =>
        current && {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((n) => (isAffected(n, variables) ? { ...n, isRead: true } : n)),
          })),
        },
      );
      queryClient.setQueryData<UnreadCounts>(countsKey, (counts) => counts && affectedCounts(counts, variables));
      return { previous };
    },
    onError: (_, __, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsKey }),
  });
}

export function useMarkNotificationRead() {
  return useMarkRead(
    (notification: AppNotification) => markNotificationsRead([notification.id]),
    (n, notification) => n.id === notification.id,
    (counts, notification) => {
      const group = notificationGroup(notification);
      return notification.isRead ? counts : { ...counts, [group]: Math.max(0, counts[group] - 1) };
    },
  );
}

export function useMarkAllNotificationsRead() {
  return useMarkRead(
    () => markAllNotificationsRead(),
    () => true,
    () => ({ matches: 0, friends: 0 }),
  );
}

/**
 * Reloads the notifications when one arrives or is read, while signed in. Call it once,
 * near the root.
 */
export function useNotificationsRealtime() {
  useEffect(() => {
    let stopListening: (() => void) | undefined;

    const stopWatchingAuth = onSignedInChange((isSignedIn) => {
      stopListening?.();
      stopListening = isSignedIn
        ? subscribeToNotificationChanges(() => void queryClient.invalidateQueries({ queryKey: notificationsKey }))
        : undefined;
    });

    return () => {
      stopWatchingAuth();
      stopListening?.();
    };
  }, []);
}
