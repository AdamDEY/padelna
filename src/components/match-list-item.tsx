import { Button, PressableFeedback } from "heroui-native";
import { Check } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { LevelRangeChip } from "@/components/level-chip";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { isPlayableFit, type LevelFit } from "@/lib/level-fit";
import type { OpenMatch } from "@/types/match";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function fitLabel(fit: LevelFit, isMixed?: boolean) {
  const base = fit === "great" ? "Great fit for your level" : "Good fit";
  return isMixed ? `${base} · Mixed match` : base;
}

function outOfRangeLabel(fit: LevelFit) {
  return fit === "above"
    ? "Above your level. You can still ask the host to join."
    : "Below your level. You can still ask the host to join.";
}

type MatchListItemProps = {
  match: OpenMatch;
  /** How the match's level range fits your level */
  fit: LevelFit;
  onPress?: () => void;
  onAskToJoin?: () => void;
};

/** An open match in the Matches list: time block, club, level, players, spots and fit. */
export function MatchListItem({ match, fit, onPress, onAskToJoin }: MatchListItemProps) {
  const time = timeFormat.format(match.startsAt);
  const playable = isPlayableFit(fit);
  const spotsLeft = Math.max(match.capacity - match.players.length, 0);
  const spotsLabel = `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"}`;
  const tintIndices = stackTintIndices(match.players);
  const note = playable ? fitLabel(fit, match.isMixed) : outOfRangeLabel(fit);

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${time}, ${match.durationMinutes} minutes, ${match.clubName}, level ${match.levelMin.toFixed(1)} to ${match.levelMax.toFixed(1)}, ${spotsLabel} left, ${match.price} TND. ${note}`}
    >
      <View className="flex-row gap-3.5 rounded-[20px] border border-line bg-surface p-3.5">
        <View className="w-[60px] items-center justify-center rounded-[14px] bg-fill">
          <Text className="font-black text-[17px] text-foreground">{time}</Text>
          <Text className="font-normal text-[12px] text-muted">{match.durationMinutes} min</Text>
        </View>

        <View className="min-w-0 flex-1 gap-2">
          <View className="flex-row items-center justify-between gap-2">
            <Text numberOfLines={1} className="flex-1 font-bold text-[16px] text-foreground">
              {match.clubName}
            </Text>
            <LevelRangeChip min={match.levelMin} max={match.levelMax} outOfRange={!playable} />
          </View>

          {playable ? (
            <>
              <View className="flex-row items-center justify-between">
                <View className="flex-row">
                  {match.players.map((player, index) => (
                    <PlayerAvatar
                      key={player.id}
                      player={player}
                      size={30}
                      tintIndex={tintIndices[index]}
                      ringClassName="border-surface"
                      className={index > 0 ? "-ms-2" : undefined}
                    />
                  ))}
                </View>
                <Text className="font-normal text-[13px] text-muted">
                  <Text className="font-bold text-foreground">{spotsLabel}</Text> · {match.price} TND
                </Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Icon as={Check} size={14} color="success" />
                <Text className="font-bold text-[12px] text-success">{note}</Text>
              </View>
            </>
          ) : (
            <>
              <Text className="font-normal text-[13px] leading-[18px] text-muted">{note}</Text>
              <Button
                size="sm"
                variant="outline"
                onPress={onAskToJoin}
                hitSlop={5}
                className="h-[34px] self-start rounded-xl px-3.5"
              >
                Ask to join
              </Button>
            </>
          )}
        </View>
      </View>
    </PressableFeedback>
  );
}
