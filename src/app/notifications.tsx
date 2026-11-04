import { router, type Href } from "expo-router";
import { Button, cn, PressableFeedback, Spinner, useToast } from "heroui-native";
import { BellOff } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { Icon } from "@/components/icon";
import { LoadError } from "@/components/load-error";
import { NotificationRow } from "@/components/notification-row";
import { NotificationRowSkeleton } from "@/components/notification-row-skeleton";
import { Page, usePageMargins } from "@/components/page";
import {
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCounts,
} from "@/hooks/useNotifications";
import { useConnectionRequests, useRespondToConnection } from "@/hooks/usePlayers";
import { errorMessage } from "@/lib/error-message";
import type { AppNotification } from "@/types/notification";

type Filter = "all" | "matches" | "friends";

const filters: Filter[] = ["all", "matches", "friends"];

/**
 * Notifications, opened from the Home bell (design canvas "Notifications"): requests,
 * match updates and reminders, unread first, with All / Matches / Friends filters.
 */
export default function Notifications() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  // The row whose Delete button is showing; only one stays open
  const openSwipe = useRef<SwipeableMethods>(null);
  const { data, error, refetch, isRefetching, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotifications(
    filter === "all" ? undefined : filter,
  );
  const { data: counts } = useUnreadCounts();
  const { data: requests } = useConnectionRequests();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteOne = useDeleteNotification();
  const respond = useRespondToConnection();

  // A request you've already answered (here, on Home or in Players) has nothing left to do
  const items = useMemo(() => {
    const pending = requests && new Set(requests.map((player) => player.id));
    return (data ?? []).filter(
      (n) => n.kind !== "connection_request" || !pending || (n.player && pending.has(n.player.id)),
    );
  }, [data, requests]);

  // Only the newest request from a player can be answered; an older one (they asked again)
  // is just history
  const answerableIds = useMemo(() => {
    const seen = new Set<string>();
    const ids = new Set<string>();
    for (const n of items) {
      if (n.kind !== "connection_request" || !n.player || seen.has(n.player.id)) continue;
      seen.add(n.player.id);
      ids.add(n.id);
    }
    return ids;
  }, [items]);

  // Counted by the database, so they cover notifications that aren't loaded yet
  const unreadCount = (group: Filter) =>
    !counts ? 0 : group === "all" ? counts.matches + counts.friends : counts[group];

  const fresh = items.filter((n) => !n.isRead);
  const earlier = items.filter((n) => n.isRead);

  function open(notification: AppNotification) {
    if (!notification.isRead) markRead.mutate(notification);
    router.push(notification.url as Href);
  }

  function handleSwipeOpen(swipeable: SwipeableMethods) {
    if (openSwipe.current && openSwipe.current !== swipeable) openSwipe.current.close();
    openSwipe.current = swipeable;
  }

  function remove(notification: AppNotification) {
    deleteOne.mutate(notification, {
      onError: (err) =>
        toast.show({ variant: "danger", label: t("notifications.deleteFailed"), description: errorMessage(err) }),
    });
  }

  function answer(notification: AppNotification, accepted: boolean) {
    const { player } = notification;
    if (!player) return;
    respond.mutate(
      { playerId: player.id, accept: accepted },
      {
        onSuccess: () => {
          markRead.mutate(notification);
          if (accepted) toast.show({ variant: "success", label: t("connections.connected", { name: player.firstName }) });
        },
        onError: (err) =>
          toast.show({ variant: "danger", label: t("connections.answerFailed"), description: errorMessage(err) }),
      },
    );
  }

  function markEverythingRead() {
    markAllRead.mutate(undefined, {
      onError: (err) =>
        toast.show({ variant: "danger", label: t("notifications.markFailed"), description: errorMessage(err) }),
    });
  }

  return (
    <Page surface>
      <Page.Header
        back
        leading={
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="font-black text-[24px] tracking-[-0.4px] text-foreground"
          >
            {t("common.notifications")}
          </Text>
        }
      >
        <PressableFeedback
          onPress={markEverythingRead}
          isDisabled={unreadCount("all") === 0}
          accessibilityRole="button"
          hitSlop={8}
          className="h-11 justify-center"
        >
          <Text className={cn("font-bold text-[14px]", unreadCount("all") === 0 ? "text-muted" : "text-accent")}>
            {t("notifications.markAllRead")}
          </Text>
        </PressableFeedback>
      </Page.Header>
      <Page.Body className="gap-0" onRefresh={() => refetch()}>
        <View className="flex-row gap-2 pb-2">
          {filters.map((value) => {
            const count = value === "all" ? 0 : unreadCount(value);
            const selected = filter === value;
            return (
              <PressableFeedback
                key={value}
                onPress={() => setFilter(value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                className={cn(
                  "h-[34px] justify-center rounded-full px-3.5",
                  selected ? "bg-ink" : "border border-line-input bg-surface",
                )}
              >
                <Text className={cn("text-[13px]", selected ? "font-bold text-white" : "font-semibold text-foreground")}>
                  {t(`notifications.filter.${value}`)}
                  {count > 0 ? ` · ${count}` : ""}
                </Text>
              </PressableFeedback>
            );
          })}
        </View>

        <List
          isLoading={!data && !error}
          failure={error && !data ? error : undefined}
          onRetry={() => refetch()}
          isRetrying={isRefetching}
          fresh={fresh}
          earlier={earlier}
          onOpen={open}
          onDelete={remove}
          onSwipeOpen={handleSwipeOpen}
          hasMore={!!hasNextPage}
          isLoadingMore={isFetchingNextPage}
          onLoadMore={() => fetchNextPage()}
          answerableIds={answerableIds}
          onAnswer={answer}
        />
      </Page.Body>
    </Page>
  );
}

type ListProps = {
  isLoading: boolean;
  failure?: unknown;
  onRetry: () => void;
  isRetrying: boolean;
  fresh: AppNotification[];
  earlier: AppNotification[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  answerableIds: Set<string>;
  onOpen: (notification: AppNotification) => void;
  onDelete: (notification: AppNotification) => void;
  onSwipeOpen: (swipeable: SwipeableMethods) => void;
  onAnswer: (notification: AppNotification, accepted: boolean) => void;
};

function List({ isLoading, failure, onRetry, isRetrying, fresh, earlier, hasMore, isLoadingMore, onLoadMore, answerableIds, onOpen, onDelete, onSwipeOpen, onAnswer }: ListProps) {
  const { t } = useTranslation();
  const { bleed } = usePageMargins();

  if (isLoading) {
    return (
      <View className={bleed}>
        <NotificationRowSkeleton />
      </View>
    );
  }

  if (failure) {
    return (
      <LoadError
        className="pt-4"
        message={t("notifications.loadFailed", { message: errorMessage(failure) })}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    );
  }

  if (fresh.length === 0 && earlier.length === 0) {
    return (
      <View className="items-center gap-3 px-6 py-16">
        <View className="size-16 items-center justify-center rounded-full bg-fill">
          <Icon as={BellOff} size={28} color="muted" />
        </View>
        <Text className="font-black text-[18px] text-foreground">{t("notifications.emptyTitle")}</Text>
        <Text className="text-center font-normal text-[15px] leading-[22px] text-ink-2">
          {t("notifications.emptyText")}
        </Text>
      </View>
    );
  }

  return (
    <View className={bleed}>
      {fresh.length > 0 ? <SectionLabel>{t("notifications.new")}</SectionLabel> : null}
      {fresh.map((n) => (
        <Row key={n.id} notification={n} answerable={answerableIds.has(n.id)} onOpen={onOpen} onDelete={onDelete} onSwipeOpen={onSwipeOpen} onAnswer={onAnswer} />
      ))}
      {earlier.length > 0 ? <SectionLabel>{t("notifications.earlier")}</SectionLabel> : null}
      {earlier.map((n) => (
        <Row key={n.id} notification={n} answerable={answerableIds.has(n.id)} onOpen={onOpen} onDelete={onDelete} onSwipeOpen={onSwipeOpen} onAnswer={onAnswer} />
      ))}
      {hasMore ? (
        <View className="items-center py-4">
          <Button variant="secondary" onPress={onLoadMore} isDisabled={isLoadingMore}>
            {isLoadingMore ? <Spinner size="sm" /> : <Button.Label>{t("notifications.showMore")}</Button.Label>}
          </Button>
        </View>
      ) : null}
    </View>
  );
}

type RowProps = {
  notification: AppNotification;
  answerable: boolean;
  onOpen: (notification: AppNotification) => void;
  onDelete: (notification: AppNotification) => void;
  onSwipeOpen: (swipeable: SwipeableMethods) => void;
  onAnswer: (notification: AppNotification, accepted: boolean) => void;
};

function Row({ notification, answerable, onOpen, onDelete, onSwipeOpen, onAnswer }: RowProps) {
  return (
    <NotificationRow
      notification={notification}
      onPress={() => onOpen(notification)}
      onDelete={() => onDelete(notification)}
      onSwipeOpen={onSwipeOpen}
      onAccept={answerable ? () => onAnswer(notification, true) : undefined}
      onIgnore={answerable ? () => onAnswer(notification, false) : undefined}
    />
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-5 pb-1.5 pt-3.5 font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
      {children}
    </Text>
  );
}
