import { cn } from "heroui-native";
import { t } from "i18next";
import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { translateCourt, translateLabel } from "@/i18n";
import { isNegativeClubTag } from "@/data/club-review-tags";
import { Icon } from "@/components/icon";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { daysUntil, formatTimeAgo } from "@/lib/format-date";
import type { ClubReview, ReviewScores } from "@/types/club";

// Scores at or below this show in orange, like weak aspects elsewhere
const LOW_SCORE = 2;

type ScoreItem = [keyof ReviewScores, "clubReviews.surface" | "clubReviews.glass" | "clubReviews.lighting" | "clubReviews.gearScore" | "clubReviews.rooms" | "clubReviews.staffScore"];

const courtScoreLabels: ScoreItem[] = [
  ["surface", "clubReviews.surface"],
  ["glass", "clubReviews.glass"],
  ["lighting", "clubReviews.lighting"],
];
const clubScoreLabels: ScoreItem[] = [
  ["gear", "clubReviews.gearScore"],
  ["rooms", "clubReviews.rooms"],
  ["staff", "clubReviews.staffScore"],
];

function reviewedAgo(date: Date) {
  const days = -daysUntil(date);
  if (days >= 2 && days < 7) return t("time.daysAgo", { count: days });
  if (days >= 7 && days < 35) return t("time.weeksAgo", { count: Math.floor(days / 7) });
  return formatTimeAgo(date);
}

type ClubReviewDetailCardProps = {
  review: ClubReview;
};

/** A full review: who, how often they play here, per-aspect scores, tags and text. */
export function ClubReviewDetailCard({ review }: ClubReviewDetailCardProps) {
  const { t } = useTranslation();
  const details = [
    review.courtName ? translateCourt(review.courtName) : null,
    review.isIndoor === undefined ? null : t(review.isIndoor ? "clubReviews.indoor" : "clubReviews.outdoor"),
    reviewedAgo(review.postedAt),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="gap-2.5 rounded-[20px] border border-line bg-surface p-3.5">
      <View className="flex-row items-center gap-2.5">
        <PlayerAvatar player={review.author} size={38} />
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="font-bold text-[14px] text-foreground">
            {shortNameOf(review.author)}
            {review.timesPlayedHere > 0 ? (
              <Text className="text-success">
                {t("clubReviews.playedHere", { count: review.timesPlayedHere })}
              </Text>
            ) : null}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {details}
          </Text>
        </View>
        <View
          accessible
          accessibilityLabel={t("clubReviews.starsA11y", { rating: review.rating.toFixed(1) })}
          className="flex-row items-center gap-[3px]"
        >
          <Icon as={Star} size={14} color="star" filled />
          <Text className="font-bold text-[13px] text-foreground">{review.rating.toFixed(1)}</Text>
        </View>
      </View>

      <View className="gap-1.5">
        <ScoreRow
          label={review.courtName ? translateCourt(review.courtName) : t("clubReviews.courtRow")}
          scores={review.scores}
          items={courtScoreLabels}
        />
        <ScoreRow label={t("clubReviews.clubRow")} scores={review.scores} items={clubScoreLabels} />
      </View>

      {review.text ? (
        <Text className="font-normal text-[14px] leading-5 text-ink-2">{review.text}</Text>
      ) : null}

      {review.tags.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <Text
              key={tag}
              className={cn(
                "overflow-hidden rounded-2xl px-2.5 py-1 font-bold text-[12px]",
                isNegativeClubTag(tag) ? "bg-attention-soft text-attention" : "bg-success-soft text-success",
              )}
            >
              {translateLabel("clubTags", tag)}
            </Text>
          ))}
        </View>
      ) : null}
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
  items: ScoreItem[];
}) {
  const { t } = useTranslation();
  const rated = items.filter(([key]) => scores[key] !== undefined);
  if (rated.length === 0) return null;

  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="w-14 font-bold text-[11px] uppercase tracking-[0.5px] text-muted">{label}</Text>
      {rated.map(([key, nameKey]) => {
        const name = t(nameKey);
        const value = scores[key]!;
        const low = value <= LOW_SCORE;
        return (
          <Text
            key={key}
            accessibilityLabel={t("clubReviews.scoreA11y", { name, value })}
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
