import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import type { PlayerSuggestion } from "@/types/player";

/** "4.5 · Lac Padel Arena · 3 friends in common" */
export function suggestionDetails(player: PlayerSuggestion) {
  const mutual = player.mutualFriendCount ?? 0;
  return [
    player.level !== undefined ? player.level.toFixed(1) : null,
    player.clubName ?? player.city,
    mutual > 0 ? `${mutual} ${mutual === 1 ? "friend" : "friends"} in common` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

type PlayerSuggestionRowProps = {
  player: PlayerSuggestion;
  /** The button(s) on the right, e.g. a ConnectButton */
  action: ReactNode;
};

/** White player row: avatar, short name, level · club · friends in common, and an action. */
export function PlayerSuggestionRow({ player, action }: PlayerSuggestionRowProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5">
      <PlayerAvatar player={player} size={40} />
      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-bold text-[15px] text-foreground">
          {shortNameOf(player)}
        </Text>
        <Text numberOfLines={2} className="font-normal text-[13px] text-muted">
          {suggestionDetails(player)}
        </Text>
      </View>
      {action}
    </View>
  );
}
