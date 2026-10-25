import { PressableFeedback } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { formatCountdown, formatMatchDateTime } from "@/lib/format-date";
import type { Player } from "@/types/player";

export type NextMatch = {
  id: string;
  startsAt: Date;
  clubName: string;
  courtName: string;
  players: Player[];
};

type NextMatchCardProps = {
  match: NextMatch;
  onPress?: () => void;
};

/** Home: the blue "Your next match" card. The whole card opens the match. */
export function NextMatchCard({ match, onPress }: NextMatchCardProps) {
  const dateTime = formatMatchDateTime(match.startsAt);
  const countdown = formatCountdown(match.startsAt);
  const place = `${match.clubName} · ${match.courtName}`;
  const tintIndices = stackTintIndices(match.players);

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Your next match, ${countdown}, ${dateTime}, ${place}. Open details`}
      className="gap-3.5 rounded-3xl bg-accent p-[18px]"
    >
      <View className="flex-row items-center justify-between">
        <Text className="font-bold text-[12px] uppercase tracking-[0.8px] text-primary-tint-text">
          Your next match
        </Text>
        <View className="rounded-[10px] bg-lime px-2.5 py-1">
          <Text className="font-bold text-[12px] text-lime-foreground">{countdown}</Text>
        </View>
      </View>

      <View className="gap-0.5">
        <Text className="font-black text-[22px] tracking-[-0.3px] text-accent-foreground">
          {dateTime}
        </Text>
        <Text className="font-normal text-[15px] text-primary-tint-text">{place}</Text>
      </View>

      <View className="flex-row items-center justify-between">
        <View className="flex-row">
          {match.players.map((player, index) => (
            <PlayerAvatar
              key={player.id}
              player={player}
              size={34}
              tintIndex={tintIndices[index]}
              ringClassName="border-accent"
              className={index > 0 ? "-ms-2.5" : undefined}
            />
          ))}
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="font-bold text-[14px] text-accent-foreground">Details</Text>
          <Icon as={ChevronRight} size={18} color="accent-foreground" />
        </View>
      </View>
    </PressableFeedback>
  );
}
