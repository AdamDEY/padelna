import { PressableFeedback } from "heroui-native";
import { Text } from "react-native";

import { LevelRangeChip } from "@/components/level-chip";
import { daysUntil } from "@/lib/format-date";
import type { OpenMatch } from "@/types/match";

const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

/** "21:30" today, otherwise "Sat 9:00" */
function whenLabel(date: Date) {
  const time = `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (daysUntil(date) === 0) return time.padStart(5, "0");
  return `${weekdayFormat.format(date)} ${time}`;
}

/** Compact open match at a club: when, spots left, booking status and level. */
export function ClubMatchRow({ match, onPress }: { match: OpenMatch; onPress?: () => void }) {
  const spotsLeft = Math.max(match.capacity - match.players.length, 0);
  const details = [
    `${spotsLeft} ${spotsLeft === 1 ? "spot" : "spots"}`,
    match.isCourtBooked ? "Court booked" : "Not booked yet",
  ].join(" · ");
  const when = whenLabel(match.startsAt);

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${when}, ${details}, level ${match.levelMin.toFixed(1)} to ${match.levelMax.toFixed(1)}`}
      className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3"
    >
      <Text numberOfLines={1} className="min-w-16 font-black text-[15px] text-foreground">
        {when}
      </Text>
      <Text numberOfLines={1} className="flex-1 font-normal text-[14px] text-muted">
        {details}
      </Text>
      <LevelRangeChip min={match.levelMin} max={match.levelMax} />
    </PressableFeedback>
  );
}
