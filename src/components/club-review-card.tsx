import { t } from "i18next";
import { Star } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { translateCourt } from "@/i18n";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { daysUntil, formatTimeAgo } from "@/lib/format-date";
import type { ClubReview } from "@/types/club";

function playedAgo(date: Date) {
  const days = -daysUntil(date);
  if (days >= 2 && days < 7) return t("time.daysAgo", { count: days });
  const ago = formatTimeAgo(date);
  return ago === t("time.yesterday") ? ago.toLowerCase() : ago;
}

/** One player's review of a club: who, which court, when, stars and what they said. */
export function ClubReviewCard({ review }: { review: ClubReview }) {
  const { t } = useTranslation();

  return (
    <View className="gap-2 rounded-[18px] border border-line p-3.5">
      <View className="flex-row items-center gap-2.5">
        <PlayerAvatar player={review.author} size={36} />
        <View className="flex-1">
          <Text className="font-bold text-[14px] text-foreground">{shortNameOf(review.author)}</Text>
          <Text className="font-normal text-[12px] text-muted">
            {review.courtName
              ? t("clubReviews.playedCourt", {
                  court: translateCourt(review.courtName),
                  when: playedAgo(review.postedAt),
                })
              : playedAgo(review.postedAt)}
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
      {review.text ? (
        <Text className="font-normal text-[14px] leading-5 text-ink-2">{review.text}</Text>
      ) : null}
    </View>
  );
}
