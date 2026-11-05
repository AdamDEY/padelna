import { Button, cn, PressableFeedback } from "heroui-native";
import {
  CalendarCheck,
  CalendarX,
  Check,
  Clock,
  MapPin,
  MessageSquare,
  Star,
  Trash2,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from "lucide-react-native";
import { t } from "i18next";
import { Fragment, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";

import { Icon } from "@/components/icon";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { daysUntil, formatMatchDateTime, formatTimeAgo, formatWeekday } from "@/lib/format-date";
import type { AppNotification, NotificationKind } from "@/types/notification";

// Width of the Delete button a swipe to the left reveals (44 px target plus room for the label)
const DELETE_ACTION_WIDTH = 88;

// Beyond this many days "2 days ago" gives way to the date
const DAYS_AGO_LIMIT = 6;

// Icon badge for notifications that aren't about a person (colours from design.md)
const badges: Partial<Record<NotificationKind, { icon: LucideIcon; bg: string; color: string }>> = {
  chat_message: { icon: MessageSquare, bg: "bg-primary-soft", color: "primary" },
  player_joined: { icon: UserPlus, bg: "bg-primary-soft", color: "primary" },
  player_left: { icon: UserMinus, bg: "bg-fill", color: "ink-2" },
  match_full: { icon: Check, bg: "bg-success-soft", color: "success-soft-foreground" },
  court_booked: { icon: CalendarCheck, bg: "bg-success-soft", color: "success-soft-foreground" },
  court_changed: { icon: MapPin, bg: "bg-primary-soft", color: "primary" },
  court_unbooked: { icon: Clock, bg: "bg-warning-soft", color: "warning" },
  match_cancelled: { icon: CalendarX, bg: "bg-attention-soft", color: "attention" },
  score_to_confirm: { icon: Star, bg: "bg-attention-soft", color: "attention" },
  rate_players: { icon: Star, bg: "bg-attention-soft", color: "attention" },
};

function timeAgo(date: Date) {
  const days = -daysUntil(date);
  if (days >= 2 && days <= DAYS_AGO_LIMIT) return t("time.daysAgo", { count: days });
  return formatTimeAgo(date);
}

/** "**Sami B.** wants to connect" → bold the parts between ** */
function RichText({ text }: { text: string }) {
  return (
    <Text className="font-normal text-[14px] leading-[20px] text-foreground">
      {text.split("**").map((part, index) =>
        index % 2 === 1 ? (
          <Text key={index} className="font-bold">
            {part}
          </Text>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </Text>
  );
}

type NotificationRowProps = {
  notification: AppNotification;
  onPress: () => void;
  /** Accept; the row shows Accept and Ignore only when both are given */
  onAccept?: () => void;
  /** Ignore */
  onIgnore?: () => void;
  /** Swiping the row to the left reveals Delete when this is given */
  onDelete?: () => void;
  /** Called as the row's Delete button opens, so the screen can close the one opened before */
  onSwipeOpen?: (swipeable: SwipeableMethods) => void;
};

/** One notification (design canvas "Notifications"): avatar or icon badge, sentence, time and unread dot. */
export function NotificationRow({ notification, onPress, onAccept, onIgnore, onDelete, onSwipeOpen }: NotificationRowProps) {
  const swipeable = useRef<SwipeableMethods>(null);
  const { t } = useTranslation();
  const { kind, player, startsAt, clubName, count, isRead } = notification;
  const badge = badges[kind];
  const text = t(`notifications.kind.${kind}`, {
    name: player ? (player.lastName ? shortNameOf(player) : player.firstName) : t("notifications.someone"),
    firstName: player?.firstName ?? t("notifications.someone"),
    when: startsAt ? formatMatchDateTime(startsAt) : "",
    weekday: startsAt ? formatWeekday(startsAt) : "",
    atClub: clubName ? t("notifications.atClub", { club: clubName }) : "",
    count,
  });
  // Buttons only where the screen says the request is still waiting for an answer
  const hasActions = !!onAccept && !!onIgnore;

  // The buttons sit beside the pressable row, not inside it, or the row would take their taps
  const row = (
    <View className={cn("border-b border-line-soft", isRead ? "bg-surface" : "bg-unread")}>
      <PressableFeedback
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${text.replaceAll("**", "")}, ${timeAgo(notification.createdAt)}${isRead ? "" : `, ${t("notifications.unread")}`}`}
        className="flex-row gap-3 px-5 py-3"
      >
        {badge ? (
          <View className={cn("size-11 items-center justify-center rounded-full", badge.bg)}>
            <Icon as={badge.icon} size={20} color={badge.color} />
          </View>
        ) : player ? (
          <PlayerAvatar player={player} size={44} />
        ) : null}

        <View className="flex-1 gap-[3px]">
          <RichText text={text} />
          <Text className="font-normal text-[12px] text-muted">{timeAgo(notification.createdAt)}</Text>
        </View>

        {/* Colour isn't the only signal: unread rows also read "unread" to screen readers */}
        <View className={cn("mt-1.5 size-2 rounded-full", isRead ? "bg-transparent" : "bg-accent")} />
      </PressableFeedback>

      {hasActions ? (
        // Lines up with the text: side padding + avatar + gap
        <View className="-mt-1 flex-row gap-2 pb-3 ps-[76px]">
          <Button size="sm" onPress={onAccept} className="h-[34px] rounded-[11px] px-4">
            <Button.Label className="font-bold text-[13px]">{t("connections.accept")}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={onIgnore}
            className="h-[34px] rounded-[11px] border-line-input px-3.5"
          >
            <Button.Label className="font-bold text-[13px] text-ink-2">{t("notifications.ignore")}</Button.Label>
          </Button>
        </View>
      ) : null}
    </View>
  );

  if (!onDelete) return row;

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      onSwipeableWillOpen={() => swipeable.current && onSwipeOpen?.(swipeable.current)}
      friction={2}
      rightThreshold={DELETE_ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={(_, __, actions) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("notifications.delete")}
          onPress={() => {
            actions.close();
            onDelete();
          }}
          className="items-center justify-center gap-1 bg-attention-soft"
          style={{ width: DELETE_ACTION_WIDTH }}
        >
          <Icon as={Trash2} size={20} color="attention" />
          <Text className="font-bold text-[13px] text-attention">{t("notifications.delete")}</Text>
        </Pressable>
      )}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
