import {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import {
  BottomSheet,
  Button,
  cn,
  TextArea,
  useBottomSheetAwareHandlers,
  useToast,
} from "heroui-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { translateCourt, translateLabel } from "@/i18n";
import { StarRating } from "@/components/star-rating";
import { clubAspects, courtAspects } from "@/data/club-review-aspects";
import { clubReviewTagOptions, MAX_CLUB_REVIEW_TAGS } from "@/data/club-review-tags";
import { useSubmitClubReview } from "@/hooks/useClubReviews";
import { errorMessage } from "@/lib/error-message";
import { formatMatchDay } from "@/lib/format-date";
import type { ClubCard, ReviewScores } from "@/types/club";

// Room the pinned Submit button takes, so the last field can scroll above it
const FOOTER_SPACE = 104;

type RateClubSheetProps = {
  club: Pick<ClubCard, "id" | "name" | "courts">;
  /** Your latest match at this club, to pre-fill the court and date */
  lastMatchHere?: { courtId?: string; playedAt: Date };
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "How was the club?" bottom sheet (design canvas "Rate the club"): court picker, star ratings, tags,
 * comment, Submit. Sending again replaces your earlier review of the club.
 */
export function RateClubSheet({ club, lastMatchHere, isOpen, onOpenChange }: RateClubSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  const submitReview = useSubmitClubReview();

  const [courtId, setCourtId] = useState(lastMatchHere?.courtId ?? null);
  const [scores, setScores] = useState<ReviewScores>({});
  const [tags, setTags] = useState<Set<string>>(() => new Set());
  const [comment, setComment] = useState("");

  const hasRating = Object.values(scores).some((value) => value > 0);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);

  // Closing clears the form, so the next review starts fresh
  function handleOpenChange(open: boolean) {
    if (!open) {
      setCourtId(lastMatchHere?.courtId ?? null);
      setScores({});
      setTags(new Set());
      setComment("");
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
    onOpenChange(open);
  }

  async function submit() {
    try {
      await submitReview.mutateAsync({
        clubId: club.id,
        courtId: courtId ?? undefined,
        // Stars cleared back to 0 count as not rated
        scores: Object.fromEntries(Object.entries(scores).filter(([, value]) => value > 0)),
        tags: [...tags],
        comment,
      });
    } catch (error) {
      toast.show({ variant: "danger", label: t("rateClub.failed"), description: errorMessage(error) });
      return;
    }
    toast.show({
      variant: "success",
      label: t("rateClub.thanks"),
      description: t("rateClub.thanksText", { club: club.name }),
    });
    handleOpenChange(false);
  }

  function setRating(aspect: keyof ReviewScores, value: number) {
    setScores((current) => ({ ...current, [aspect]: value }));
  }

  function toggleTag(label: string) {
    setTags((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else if (next.size < MAX_CLUB_REVIEW_TAGS) next.add(label);
      return next;
    });
  }

  const subtitle = lastMatchHere
    ? `${club.name} · ${formatMatchDay(lastMatchHere.playedAt)}`
    : club.name;

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["94%"]}
          enableDynamicSizing={false}
          enableOverDrag={false}
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          contentContainerClassName="h-full p-0"
          backgroundClassName="bg-background"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
          footerComponent={(props: BottomSheetFooterProps) => (
            // Submit stays pinned at the bottom while the form scrolls
            <BottomSheetFooter {...props}>
              <View
                className="bg-background px-5 pt-3"
                style={{ paddingBottom: Math.max(insets.bottom, 34) }}
              >
                <Button size="lg" isDisabled={!hasRating || submitReview.isPending} onPress={submit}>
                  {t("rateClub.submit")}
                </Button>
              </View>
            </BottomSheetFooter>
          )}
        >
          <View className="flex-row items-start justify-between gap-3 px-5 pb-3 pt-1">
            <View className="flex-1">
              <BottomSheet.Title className="font-black text-[22px] tracking-[-0.3px] text-foreground">
                {t("rateClub.title")}
              </BottomSheet.Title>
              <BottomSheet.Description
                numberOfLines={1}
                className="font-normal text-[13px] text-muted"
              >
                {subtitle}
              </BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-9 rounded-full bg-surface" />
          </View>

          <BottomSheetScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: FOOTER_SPACE, gap: 16 }}
          >
            <View className="gap-2">
              <View className="flex-row items-baseline justify-between">
                <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
                  {t("rateClub.court")}
                </Text>
                {lastMatchHere?.courtId ? (
                  <Text className="font-normal text-[12px] text-muted">{t("rateClub.fromMatch")}</Text>
                ) : null}
              </View>
              <View accessibilityRole="radiogroup" className="flex-row gap-1.5">
                {club.courts.map((court) => {
                  const selected = court.id === courtId;
                  return (
                    <Pressable
                      key={court.id}
                      // Tapping the chosen court again clears it
                      onPress={() => setCourtId(selected ? null : court.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={translateCourt(`Court ${court.number}`)}
                      hitSlop={{ top: 4, bottom: 4 }}
                      className={cn(
                        "h-9 flex-1 items-center justify-center rounded-xl",
                        selected ? "bg-foreground" : "border border-line-input bg-surface",
                      )}
                    >
                      <Text
                        className={cn(
                          "text-[13px]",
                          selected ? "font-bold text-background" : "font-semibold text-foreground",
                        )}
                      >
                        C{court.number}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <RatingCard aspects={courtAspects} scores={scores} onChange={setRating} />
            </View>

            <View className="gap-2">
              <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
                {t("rateClub.theClub")}
              </Text>
              <RatingCard aspects={clubAspects} scores={scores} onChange={setRating} />
            </View>

            <View className="gap-2">
              <View className="flex-row items-baseline justify-between">
                <Text className="font-bold text-[14px] text-foreground">{t("rateClub.stand")}</Text>
                <Text className="font-normal text-[12px] text-muted">
                  {t("rateClub.standHint", { count: MAX_CLUB_REVIEW_TAGS })}
                </Text>
              </View>
              <View className="flex-row flex-wrap gap-1.5">
                {clubReviewTagOptions.map((tag) => {
                  const selected = tags.has(tag.label);
                  return (
                    <Pressable
                      key={tag.label}
                      onPress={() => toggleTag(tag.label)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      hitSlop={6}
                      className={cn(
                        "h-8 justify-center rounded-2xl px-2.5",
                        !selected && "border border-line-input bg-surface",
                        selected && (tag.negative ? "bg-attention-soft" : "bg-success-soft"),
                      )}
                    >
                      <Text
                        className={cn(
                          "text-[13px]",
                          !selected && "font-semibold text-ink-2",
                          selected && "font-bold",
                          selected && (tag.negative ? "text-attention" : "text-success"),
                        )}
                      >
                        {translateLabel("clubTags", tag.label)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <CommentField
              value={comment}
              onChange={setComment}
              // The comment is last: once the keyboard is up, bring it into view
              onFocused={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
            />
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/** Comment box that lifts the sheet when the keyboard opens */
function CommentField({
  value,
  onChange,
  onFocused,
}: {
  value: string;
  onChange: (text: string) => void;
  onFocused: () => void;
}) {
  const { t } = useTranslation();
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <TextArea
      value={value}
      onChangeText={onChange}
      onFocus={(event) => {
        onFocus(event);
        onFocused();
      }}
      onBlur={onBlur}
      placeholder={t("rateClub.commentPlaceholder")}
      accessibilityLabel={t("rateClub.comment")}
      numberOfLines={3}
      className="min-h-20"
    />
  );
}

function RatingCard({
  aspects,
  scores,
  onChange,
}: {
  aspects: readonly { key: keyof ReviewScores; label: string }[];
  scores: ReviewScores;
  onChange: (aspect: keyof ReviewScores, value: number) => void;
}) {
  return (
    <View className="rounded-[20px] border border-line bg-surface px-3.5 py-0.5">
      {aspects.map((aspect, index) => (
        <View
          key={aspect.key}
          className={cn(
            "h-11 flex-row items-center justify-between",
            index < aspects.length - 1 && "border-b border-fill",
          )}
        >
          <Text className="font-bold text-[14px] text-foreground">{translateLabel("aspects", aspect.label)}</Text>
          <StarRating
            label={translateLabel("aspects", aspect.label)}
            value={scores[aspect.key] ?? 0}
            onChange={(value) => onChange(aspect.key, value)}
          />
        </View>
      ))}
    </View>
  );
}
