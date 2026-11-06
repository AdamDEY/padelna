import { useLocalSearchParams } from "expo-router";
import { Button, cn } from "heroui-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ChoiceChips } from "@/components/choice-chips";
import { ClubReviewDetailCard } from "@/components/club-review-detail-card";
import { LoadError } from "@/components/load-error";
import { Page } from "@/components/page";
import { useClubRatings, useClubReviews } from "@/hooks/useClubReviews";
import { useClubCard } from "@/hooks/useClubs";
import { useRateClub } from "@/hooks/useRateClub";
import { errorMessage } from "@/lib/error-message";
import type { ClubCard, ClubReview, ReviewScores } from "@/types/club";

type Topic = "all" | "courts" | "gear" | "facilities" | "staff";

// The scores each topic filter looks at
const topicScores: Record<Exclude<Topic, "all">, (keyof ReviewScores)[]> = {
  courts: ["surface", "glass", "lighting"],
  gear: ["gear"],
  facilities: ["rooms"],
  staff: ["staff"],
};

// Courts per row of the "By court" grid
const COURTS_PER_ROW = 6;
// Court scores below this show in orange
const WEAK_COURT = 4;

function talksAbout(review: ClubReview, topic: Topic) {
  return topic === "all" || topicScores[topic].some((key) => review.scores[key] !== undefined);
}

/** A club's reviews (design canvas "Club reviews"): topic filter, score per court, every review. */
export default function ClubReviews() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { club } = useClubCard(id);
  const ratingsQuery = useClubRatings(id);
  const reviewsQuery = useClubReviews(id);
  const rateClub = useRateClub(club);
  const [topic, setTopic] = useState<Topic>("all");

  const ratings = ratingsQuery.data;
  const reviews = reviewsQuery.data;
  const shown = useMemo(() => (reviews ?? []).filter((review) => talksAbout(review, topic)), [reviews, topic]);

  const topicOptions = [
    { value: "all", label: t("clubReviews.all") },
    { value: "courts", label: t("clubReviews.courts") },
    { value: "gear", label: t("clubReviews.gear") },
    { value: "facilities", label: t("clubReviews.facilities") },
    { value: "staff", label: t("clubReviews.staff") },
  ] satisfies { value: Topic; label: string }[];

  const error = ratingsQuery.error ?? reviewsQuery.error;
  const subtitle =
    club && ratings && ratings.reviewCount > 0
      ? t("clubReviews.subtitle", {
          club: club.name,
          rating: ratings.rating.toFixed(1),
          count: ratings.reviewCount,
        })
      : club?.name;

  return (
    <Page>
      <Page.Header back title={t("clubReviews.title")} />
      <Page.Body className="gap-3.5">
        {subtitle ? <Text className="font-normal text-[13px] text-muted">{subtitle}</Text> : null}

        {error && !reviews ? (
          <LoadError
            message={t("clubDetail.reviewsFailed", { message: errorMessage(error) })}
            onRetry={() => {
              void ratingsQuery.refetch();
              void reviewsQuery.refetch();
            }}
            isRetrying={ratingsQuery.isRefetching || reviewsQuery.isRefetching}
          />
        ) : reviews && reviews.length === 0 ? (
          <View className="items-center gap-1 rounded-3xl border border-line bg-surface p-6">
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              {t("clubReviews.emptyTitle")}
            </Text>
            <Text className="text-center font-normal text-[14px] leading-5 text-muted">
              {t("clubReviews.emptyAll")}
            </Text>
          </View>
        ) : reviews ? (
          <>
            <ChoiceChips options={topicOptions} value={topic} onChange={setTopic} />

            {ratings && ratings.courtRatings.length > 0 ? (
              <CourtScores courts={ratings.courtRatings} club={club} />
            ) : null}

            <Text className="font-black text-[14px] text-foreground">
              {t("clubReviews.count", { count: shown.length })}
              <Text className="font-normal text-muted"> · {t("clubReviews.sortRecent")}</Text>
            </Text>

            {shown.length === 0 ? (
              <Text className="font-normal text-[14px] text-muted">{t("clubReviews.emptyTopic")}</Text>
            ) : (
              shown.map((review) => <ClubReviewDetailCard key={review.id} review={review} />)
            )}
          </>
        ) : null}
      </Page.Body>

      {club ? (
        <Page.Footer className="border-t border-line bg-surface">
          <Button size="lg" onPress={rateClub.start}>
            {t("clubReviews.write")}
          </Button>
        </Page.Footer>
      ) : null}
      {rateClub.sheet}
    </Page>
  );
}

/** Average of the court scores (surface, glass, lighting) for each court that has one. */
function CourtScores({
  courts,
  club,
}: {
  courts: { number: number; rating: number }[];
  club: ClubCard | undefined;
}) {
  const { t } = useTranslation();
  const rows = Array.from({ length: Math.ceil(courts.length / COURTS_PER_ROW) }, (_, row) =>
    courts.slice(row * COURTS_PER_ROW, (row + 1) * COURTS_PER_ROW),
  );

  return (
    <View className="gap-1.5">
      <Text className="font-bold text-[13px] text-muted">{t("clubReviews.byCourt")}</Text>
      {rows.map((row) => (
        <View key={row[0].number} className="flex-row gap-1.5">
          {row.map((court) => {
            const isIndoor = club?.courts.find((item) => item.number === court.number)?.indoor;
            const weak = court.rating < WEAK_COURT;
            const kind = isIndoor === undefined ? undefined : t(isIndoor ? "clubReviews.indoor" : "clubReviews.outdoor");
            return (
              <View
                key={court.number}
                accessible
                accessibilityLabel={t("clubReviews.courtA11y", {
                  number: court.number,
                  kind,
                  value: court.rating.toFixed(1),
                })}
                className={cn(
                  "min-h-[52px] flex-1 items-center justify-center rounded-xl py-2",
                  weak ? "bg-attention-soft" : "border border-line bg-surface",
                )}
              >
                <Text className={cn("font-normal text-[11px]", weak ? "text-attention" : "text-muted")}>
                  C{court.number}
                  {isIndoor === false ? t("clubReviews.outSuffix") : ""}
                </Text>
                <Text className={cn("font-black text-[14px]", weak ? "text-attention" : "text-foreground")}>
                  {court.rating.toFixed(1)}
                </Text>
              </View>
            );
          })}
          {/* Keep the cells of a short last row the same width as the rows above */}
          {Array.from({ length: COURTS_PER_ROW - row.length }, (_, i) => (
            <View key={`spacer-${i}`} className="flex-1" />
          ))}
        </View>
      ))}
    </View>
  );
}
