import { PressableFeedback } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { PlayerAvatar } from "@/components/player-avatar";
import type { Player } from "@/types/player";

export const RISING_PLAYER_WIDTH = 86;

type RisingPlayerProps = {
  player: Player;
  /** Level gained this month */
  levelChange: number;
  city: string;
  onPress?: () => void;
};

/** A player climbing fast: avatar with a lime ring, name, level gain and city. */
export function RisingPlayer({ player, levelChange, city, onPress }: RisingPlayerProps) {
  const { t } = useTranslation();
  const name = `${player.firstName} ${player.lastName.charAt(0)}.`;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("community.risingA11y", { name, change: levelChange.toFixed(1), city })}
      className="items-center gap-[3px]"
      style={{ width: RISING_PLAYER_WIDTH }}
    >
      <PlayerAvatar player={player} size={52} ringClassName="border-lime" />
      <Text numberOfLines={1} className="font-bold text-[13px] text-foreground">
        {name}
      </Text>
      <Text numberOfLines={1} className="font-bold text-[11px] text-success">
        ▲ {levelChange.toFixed(1)} · {city}
      </Text>
    </PressableFeedback>
  );
}
