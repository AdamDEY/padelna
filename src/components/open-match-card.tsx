import { Button, PressableFeedback } from "heroui-native";
import { Plus } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { LevelRangeChip } from "@/components/level-chip";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { formatShortMatchDateTime } from "@/lib/format-date";
import type { Player } from "@/types/player";

export type OpenMatch = {
  id: string;
  startsAt: Date;
  clubName: string;
  durationMinutes: number;
  levelMin: number;
  levelMax: number;
  players: Player[];
  /** Padel is played 2 vs 2 */
  capacity: number;
  /** Price per player, in TND */
  price: number;
};

type OpenMatchCardProps = {
  match: OpenMatch;
  onPress?: () => void;
  onJoin?: () => void;
  /** Fixed width when the card sits in a carousel */
  width?: number;
};

const SLOT_SIZE = 36;

/** An open match looking for players. The card opens the match; Join asks to join it. */
export function OpenMatchCard({ match, onPress, onJoin, width }: OpenMatchCardProps) {
  const when = formatShortMatchDateTime(match.startsAt);
  const where = `${match.clubName} · ${match.durationMinutes} min`;
  const spotsLeft = Math.max(match.capacity - match.players.length, 0);
  const spotsLabel = `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"}`;
  const tintIndices = stackTintIndices(match.players);

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${when}, ${where}, level ${match.levelMin.toFixed(1)} to ${match.levelMax.toFixed(1)}, ${spotsLabel} left, ${match.price} TND`}
      style={width ? { width } : undefined}
    >
      <View className="gap-3 rounded-[20px] border border-line bg-surface p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-black text-[16px] text-foreground">{when}</Text>
          <LevelRangeChip min={match.levelMin} max={match.levelMax} />
        </View>
        <Text className="-mt-1.5 font-normal text-[14px] text-muted">{where}</Text>

        <View className="flex-row gap-1.5">
          {match.players.map((player, index) => (
            <PlayerAvatar
              key={player.id}
              player={player}
              size={SLOT_SIZE}
              tintIndex={tintIndices[index]}
            />
          ))}
          {Array.from({ length: spotsLeft }, (_, index) => (
            // Open spots: dashed circles; the first one carries a + (design.md "Empty slot")
            <View
              key={`open-${index}`}
              className="items-center justify-center rounded-full border-2 border-dashed border-slot-border"
              style={{ width: SLOT_SIZE, height: SLOT_SIZE }}
            >
              {index === 0 ? <Icon as={Plus} size={16} color="accent" /> : null}
            </View>
          ))}
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="font-normal text-[13px] text-muted">
            <Text className="font-bold text-foreground">{spotsLabel}</Text> · {match.price} TND
          </Text>
          <Button size="sm" onPress={onJoin} hitSlop={4} className="h-9 rounded-xl px-4">
            Join
          </Button>
        </View>
      </View>
    </PressableFeedback>
  );
}
