import { cn, PressableFeedback } from "heroui-native";
import { Text, View } from "react-native";

import { formatMatchDay } from "@/lib/format-date";
import type { PastMatch } from "@/types/match";

type PastMatchRowProps = {
  match: PastMatch;
  onPress?: () => void;
};

/**
 * A finished match: W/L badge (a letter, so colour is never the only signal),
 * set scores and when and where it was played.
 */
export function PastMatchRow({ match, onPress }: PastMatchRowProps) {
  const score = match.sets.map(([mine, theirs]) => `${mine}–${theirs}`).join(" · ");
  const details = `${formatMatchDay(match.playedAt)} · ${match.clubName}`;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${match.won ? "Won" : "Lost"} ${score}, ${details}`}
    >
      <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
        <View
          className={cn(
            "size-8 items-center justify-center rounded-[10px]",
            match.won ? "bg-lime-soft" : "bg-out-of-range",
          )}
        >
          <Text
            className={cn(
              "font-black text-[14px]",
              match.won ? "text-lime-foreground" : "text-muted",
            )}
          >
            {match.won ? "W" : "L"}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="font-bold text-[14px] text-foreground">{score}</Text>
          <Text className="font-normal text-[12px] text-muted">{details}</Text>
        </View>
      </View>
    </PressableFeedback>
  );
}
