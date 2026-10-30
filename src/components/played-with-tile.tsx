import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ConnectButton } from "@/components/connect-button";
import { PlayerAvatar } from "@/components/player-avatar";
import type { PlayerSuggestion } from "@/types/player";

type PlayedWithTileProps = {
  player: PlayerSuggestion;
  /** Opens the player's preview */
  onPress?: () => void;
};

/** Face, first name and a small Connect button, four to a row (design: Find players · You played with). */
export function PlayedWithTile({ player, onPress }: PlayedWithTileProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 items-center gap-1">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t("connections.viewProfile", { name: player.firstName })}
        className="items-center gap-1 self-stretch"
      >
        <PlayerAvatar player={player} size={48} />
        <Text numberOfLines={1} className="font-bold text-[13px] text-foreground">
          {player.firstName}
        </Text>
      </Pressable>
      <ConnectButton player={player} size="sm" />
    </View>
  );
}
