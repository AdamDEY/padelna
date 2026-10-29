import { cn, PressableFeedback } from "heroui-native";
import { Text, View } from "react-native";

import { formatMatchDay } from "@/lib/format-date";
import type { PastMatch } from "@/types/match";

// A letter on every row, so colour is never the only signal; "–" when there is no result yet
const badges = { won: "W", lost: "L", unconfirmed: "–", none: "–" } as const;
const labels = {
  won: "Won",
  lost: "Lost",
  unconfirmed: "Score not confirmed",
  none: "No score",
} as const;

type PastMatchRowProps = {
  match: PastMatch;
  onPress?: () => void;
};

/**
 * A finished match: W/L badge (a letter, so colour is never the only signal),
 * set scores and when and where it was played.
 */
export function PastMatchRow({ match, onPress }: PastMatchRowProps) {
  const score =
    match.sets.map(([mine, theirs]) => `${mine}–${theirs}`).join(" · ") ||
    "No score";
  const details = [
    formatMatchDay(match.playedAt),
    match.clubName,
    match.result === "unconfirmed" ? "Waiting for confirmation" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const won = match.result === "won";

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${labels[match.result]} ${score}, ${details}`}
    >
      <View className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
        <View
          className={cn(
            "size-8 items-center justify-center rounded-[10px]",
            won ? "bg-lime-soft" : "bg-out-of-range",
          )}
        >
          <Text
            className={cn(
              "font-black text-[14px]",
              won ? "text-lime-foreground" : "text-muted",
            )}
          >
            {badges[match.result]}
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
