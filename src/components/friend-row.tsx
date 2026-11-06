import { Button, cn } from "heroui-native";
import { t } from "i18next";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { formatDayMonth } from "@/lib/format-date";
import { closeGap, slideOutLeft } from "@/lib/motion";
import type { Friend } from "@/types/player";

type FriendRowProps = {
  friend: Friend;
  onPress: () => void;
  onRemove: () => void;
  isBusy?: boolean;
  /** A line above the row, for every row but the first in the list */
  showDivider?: boolean;
  /** Set while this friend is being removed, so only that row slides out (not rows a search hides) */
  isRemoving?: boolean;
};

/**
 * One friend in My friends: avatar, name with level, matches together and a Remove button.
 * A removed friend slides off to the left and the rows below glide up.
 */
export function FriendRow({ friend, onPress, onRemove, isBusy, showDivider, isRemoving }: FriendRowProps) {
  const together =
    friend.matchesTogether > 0 && friend.lastPlayedAt
      ? t("friends.matchesTogether", { count: friend.matchesTogether, date: formatDayMonth(friend.lastPlayedAt) })
      : t("friends.notPlayedYet");

  return (
    // The divider is part of the row so it leaves with it
    <Animated.View
      exiting={isRemoving ? slideOutLeft : undefined}
      layout={closeGap}
      className={cn("flex-row items-center gap-3 py-2.5", showDivider && "border-t border-fill")}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("connections.viewProfile", { name: shortNameOf(friend) })}
        className="min-w-0 flex-1 flex-row items-center gap-3"
      >
        <PlayerAvatar player={friend} size={44} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text numberOfLines={1} className="shrink font-bold text-[15px] text-foreground">
              {shortNameOf(friend)}
            </Text>
            {friend.level !== undefined ? (
              <Text className="overflow-hidden rounded-[7px] bg-lime-soft px-1.5 font-black text-[11px] text-lime-foreground">
                {friend.level.toFixed(1)}
              </Text>
            ) : null}
          </View>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {together}
          </Text>
        </View>
      </Pressable>
      <Button
        size="sm"
        variant="outline"
        onPress={onRemove}
        isDisabled={isBusy}
        accessibilityLabel={t("friends.removeA11y", { name: friend.firstName })}
        hitSlop={5}
        className="h-[34px] rounded-xl border-attention-outline px-3"
      >
        <Button.Label className="text-[13px] text-attention-action">{t("friends.remove")}</Button.Label>
      </Button>
    </Animated.View>
  );
}
