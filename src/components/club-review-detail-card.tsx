import { cn, PressableFeedback } from "heroui-native";
import { Text, View } from "react-native";

import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { daysUntil, formatTimeAgo } from "@/lib/format-date";
import type { ClubReview, ReviewScores } from "@/types/club";

// Scores at or below this show in orange, like weak aspects elsewhere
const LOW_SCORE = 2;

const courtScoreLabels: [keyof ReviewScores, string][] = [
  ["surface", "Surface"],
  ["glass", "Glass"],
  ["lighting", "Lighting"],
];
const clubScoreLabels: [keyof ReviewScores, string][] = [
  ["gear", "Gear"],
  ["rooms", "Rooms"],
  ["staff", "Staff"],
];

function reviewedAgo(date: Date) {
  const days = -daysUntil(date);
  if (days >= 2 && days < 7) return `${days} days ago`;
  if (days >= 7 && days < 14) return "1 week ago";
  if (days >= 14 && days < 35) return `${Math.floor(days / 7)} weeks ago`;
  return formatTimeAgo(date);
}

type ClubReviewDetailCardProps = {
  review: ClubReview;
  /** Whether the court was indoor, shown next to the court name */
  isIndoor?: boolean;
  markedHelpful: boolean;
  onToggleHelpful: () => void;
};

/** A full review: who, how often they play here, per-aspect scores, text and Helpful. */
export function ClubReviewDetailCard({
  review,
  isIndoor,
  markedHelpful,
  onToggleHelpful,
}: ClubReviewDetailCardProps) {
  const details = [
    review.courtName,
    isIndoor === undefined ? null : isIndoor ? "indoor" : "outdoor",
    review.playedTime,
    reviewedAgo(review.postedAt),
  ]
    .filter(Boolean)
    .join(" · ");
  const helpfulCount = review.helpfulCount + (markedHelpful ? 1 : 0);

  return (
    <View className="gap-2.5 rounded-[20px] border border-line bg-surface p-3.5">
      <View className="flex-row items-center gap-2.5">
        <PlayerAvatar player={review.author} size={38} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-bold text-[14px] text-foreground">
            {shortNameOf(review.author)}
            {review.timesPlayedHere ? (
              <Text className="text-success"> · played here {review.timesPlayedHere}×</Text>
            ) : null}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {details}
          </Text>
        </View>
      </View>

      {review.scores ? (
        <View className="gap-1.5">
          <ScoreRow label={review.courtName} scores={review.scores} items={courtScoreLabels} />
          <ScoreRow label="Club" scores={review.scores} items={clubScoreLabels} />
        </View>
      ) : null}

      <Text className="font-normal text-[14px] leading-5 text-ink-2">{review.text}</Text>

      <View className="flex-row items-center gap-2">
        <PressableFeedback
          onPress={onToggleHelpful}
          accessibilityRole="button"
          accessibilityState={{ selected: markedHelpful }}
          accessibilityLabel={`Helpful, ${helpfulCount} players${markedHelpful ? ", including you" : ""}`}
          hitSlop={6}
          className={cn(
            "h-8 justify-center rounded-[10px] px-2.5",
            markedHelpful ? "bg-primary-soft" : "bg-fill",
          )}
        >
          <Text
            className={cn(
              "font-bold text-[12px]",
              markedHelpful ? "text-primary-dark" : "text-foreground",
            )}
          >
            Helpful · {helpfulCount}
          </Text>
        </PressableFeedback>
        {review.clubReplied ? (
          <Text className="font-normal text-[12px] text-muted">Club replied</Text>
        ) : null}
      </View>
    </View>
  );
}

function ScoreRow({
  label,
  scores,
  items,
}: {
  label: string;
  scores: ReviewScores;
  items: [keyof ReviewScores, string][];
}) {
  const rated = items.filter(([key]) => scores[key] !== undefined);
  if (rated.length === 0) return null;

  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="w-14 font-bold text-[11px] uppercase tracking-[0.5px] text-muted">{label}</Text>
      {rated.map(([key, name]) => {
        const value = scores[key]!;
        const low = value <= LOW_SCORE;
        return (
          <Text
            key={key}
            accessibilityLabel={`${name} ${value} out of 5`}
            className={cn(
              "overflow-hidden rounded-[10px] px-2 py-[5px] font-semibold text-[12px]",
              low ? "bg-attention-soft text-attention" : "bg-background text-foreground",
            )}
          >
            {name} <Text className="font-black">{value}</Text>
          </Text>
        );
      })}
    </View>
  );
}
