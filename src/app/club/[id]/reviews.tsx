import { Button, cn } from "heroui-native";
import { useLocalSearchParams } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ChoiceChips } from "@/components/choice-chips";
import { ClubReviewDetailCard } from "@/components/club-review-detail-card";
import { Icon } from "@/components/icon";
import { Page } from "@/components/page";
import { RateClubSheet } from "@/components/rate-club-sheet";
import { getClubDetails } from "@/data/mock";
import type { ReviewTopic } from "@/types/club";

const ALL = "all";

const topics = [
  { value: ALL, label: "clubReviews.all" },
  { value: "courts", label: "clubReviews.courts" },
  { value: "gear", label: "clubReviews.gear" },
  { value: "facilities", label: "clubReviews.facilities" },
  { value: "staff", label: "clubReviews.staff" },
] as const satisfies { value: ReviewTopic | typeof ALL; label: string }[];

type SortOrder = "recent" | "helpful";

const sortLabels = {
  recent: "clubReviews.sortRecent",
  helpful: "clubReviews.sortHelpful",
} as const satisfies Record<SortOrder, string>;

// Court averages below this show in orange
const WEAK_COURT = 4;

export default function ClubReviews() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = getClubDetails(id);
  const [topic, setTopic] = useState<ReviewTopic | typeof ALL>(ALL);
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [helpfulIds, setHelpfulIds] = useState<Set<string>>(() => new Set());
  const [isRating, setIsRating] = useState(false);

  const reviews = useMemo(
    () =>
      (club?.reviews ?? [])
        .filter((review) => topic === ALL || review.topics.includes(topic))
        .sort((a, b) =>
          sortOrder === "recent"
            ? b.postedAt.getTime() - a.postedAt.getTime()
            : b.helpfulCount - a.helpfulCount,
        ),
    [club, topic, sortOrder],
  );

  if (!club) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body>
          <Page.Title>{t("clubDetail.notFoundTitle")}</Page.Title>
        </Page.Body>
      </Page>
    );
  }

  function toggleHelpful(reviewId: string) {
    setHelpfulIds((current) => {
      const next = new Set(current);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  }

  // "Court 3" -> index 2, to know whether it was indoor
  function isIndoorCourt(courtName: string) {
    const number = Number(courtName.replace(/\D/g, ""));
    return number > 0 ? number <= club!.indoorCourts : undefined;
  }

  return (
    <Page>
      <Page.Header
        back
        leading={
          <>
            <Text
              accessibilityRole="header"
              className="font-black text-[22px] tracking-[-0.3px] text-foreground"
            >
              {t("clubReviews.title")}
            </Text>
            <Text numberOfLines={1} className="font-normal text-[13px] text-muted">
              {t("clubReviews.subtitle", {
                club: club.name,
                rating: club.rating.toFixed(1),
                count: club.reviewCount,
              })}
            </Text>
          </>
        }
      />

      <Page.Body className="gap-3.5">
        <ChoiceChips
          options={topics.map((item) => ({ value: item.value, label: t(item.label) }))}
          value={topic}
          onChange={setTopic}
        />

        {club.courtRatings && club.courtRatings.length > 0 ? (
          <View className="gap-1.5">
            <Text className="font-bold text-[13px] text-muted">
              {t("clubReviews.byCourt")}
            </Text>
            <View className="flex-row gap-1.5">
              {club.courtRatings.map((value, index) => {
                const outdoor = index >= club.indoorCourts;
                const weak = value < WEAK_COURT;
                return (
                  <View
                    key={index}
                    accessible
                    accessibilityLabel={t("clubReviews.courtA11y", {
                      number: index + 1,
                      kind: t(outdoor ? "clubReviews.outdoor" : "clubReviews.indoor"),
                      value: value.toFixed(1),
                    })}
                    className={cn(
                      "flex-1 items-center rounded-xl py-2",
                      weak ? "bg-attention-soft" : "border border-line bg-surface",
                    )}
                  >
                    <Text
                      numberOfLines={1}
                      className={cn("font-normal text-[11px]", weak ? "text-attention" : "text-muted")}
                    >
                      C{index + 1}
                      {outdoor ? t("clubReviews.outSuffix") : ""}
                    </Text>
                    <Text
                      className={cn("font-black text-[14px]", weak ? "text-attention" : "text-foreground")}
                    >
                      {value.toFixed(1)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-[14px] text-foreground">
            {t("clubReviews.count", { count: reviews.length })}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("clubReviews.sortA11y", { order: t(sortLabels[sortOrder]).toLowerCase() })}
            onPress={() => setSortOrder((order) => (order === "recent" ? "helpful" : "recent"))}
            hitSlop={10}
            className="flex-row items-center gap-1"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text className="font-bold text-[13px] text-link">{t(sortLabels[sortOrder])}</Text>
            <Icon as={ChevronDown} size={14} color="link" />
          </Pressable>
        </View>

        <View className="gap-3">
          {reviews.map((review) => (
            <ClubReviewDetailCard
              key={review.id}
              review={review}
              isIndoor={isIndoorCourt(review.courtName)}
              markedHelpful={helpfulIds.has(review.id)}
              onToggleHelpful={() => toggleHelpful(review.id)}
            />
          ))}
          {reviews.length === 0 ? (
            <View className="items-center gap-1 rounded-[20px] border border-line bg-surface p-6">
              <Text className="font-bold text-[15px] text-foreground">{t("clubReviews.emptyTitle")}</Text>
              <Text className="text-center font-normal text-[14px] text-muted">
                {topic === ALL
                  ? t("clubReviews.emptyAll")
                  : t("clubReviews.emptyTopic")}
              </Text>
            </View>
          ) : null}
        </View>
      </Page.Body>

      <Page.Footer className="border-t border-line bg-surface">
        <Button size="lg" onPress={() => setIsRating(true)}>
          {t("clubReviews.write")}
        </Button>
      </Page.Footer>

      <RateClubSheet club={club} isOpen={isRating} onOpenChange={setIsRating} />
    </Page>
  );
}
