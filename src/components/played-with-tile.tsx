import { Text, View } from "react-native";

import { ConnectButton } from "@/components/connect-button";
import { PlayerAvatar } from "@/components/player-avatar";
import type { PlayerSuggestion } from "@/types/player";

type PlayedWithTileProps = {
  player: PlayerSuggestion;
};

/** Face, first name and a small Connect button, four to a row (design: Find players · You played with). */
export function PlayedWithTile({ player }: PlayedWithTileProps) {
  return (
    <View className="flex-1 items-center gap-1">
      <PlayerAvatar player={player} size={48} />
      <Text numberOfLines={1} className="font-bold text-[13px] text-foreground">
        {player.firstName}
      </Text>
      <ConnectButton player={player} size="sm" />
    </View>
  );
}
