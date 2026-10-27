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
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StarRating } from "@/components/star-rating";
import { clubReviewTagOptions, pastMatches } from "@/data/mock";
import { formatMatchDay } from "@/lib/format-date";
import type { ClubDetails } from "@/types/club";

const courtAspects = ["Court surface", "Glass & walls", "Lighting"];
const clubAspects = ["Rackets & balls", "Changing rooms", "Staff & welcome"];

// Room the pinned Submit button takes, so the last field can scroll above it
const FOOTER_SPACE = 104;

type RateClubSheetProps = {
  club: ClubDetails;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/** "How was the club?" bottom sheet: court picker, star ratings, tags, comment, Submit. */
export function RateClubSheet({ club, isOpen, onOpenChange }: RateClubSheetProps) {
  const insets = useSafeAreaInsets();
  const { toast } = useToast();

  // Pre-fill the court and date from your latest match here
  const lastMatchHere = pastMatches.find((match) => match.clubName === club.name);
  const courts = Array.from({ length: club.courtCount }, (_, i) => `Court ${i + 1}`);

  const [court, setCourt] = useState(lastMatchHere?.courtName ?? null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<Set<string>>(() => new Set());
  const [comment, setComment] = useState("");

  const hasRating = Object.values(ratings).some((value) => value > 0);
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);

  // Closing clears the form, so the next review starts fresh
  function handleOpenChange(open: boolean) {
    if (!open) {
      setCourt(lastMatchHere?.courtName ?? null);
      setRatings({});
      setTags(new Set());
      setComment("");
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
    onOpenChange(open);
  }

  function submit() {
    // Nothing is saved yet; the API will take the court, ratings, tags and comment
    toast.show({
      variant: "success",
      label: "Thanks for your review",
      description: `It helps other players choose ${club.name}.`,
    });
    handleOpenChange(false);
  }

  function setRating(aspect: string, value: number) {
    setRatings((current) => ({ ...current, [aspect]: value }));
  }

  function toggleTag(label: string) {
    setTags((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
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
                <Button size="lg" isDisabled={!hasRating} onPress={submit}>
                  Submit
                </Button>
              </View>
            </BottomSheetFooter>
          )}
        >
          <View className="flex-row items-start justify-between gap-3 px-5 pb-3 pt-1">
            <View className="flex-1">
              <BottomSheet.Title className="font-black text-[22px] tracking-[-0.3px] text-foreground">
                How was the club?
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
                  The court you played on
                </Text>
                {lastMatchHere?.courtName ? (
                  <Text className="font-normal text-[12px] text-muted">From your match</Text>
                ) : null}
              </View>
              <View accessibilityRole="radiogroup" className="flex-row gap-1.5">
                {courts.map((name, index) => {
                  const selected = name === court;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => setCourt(name)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={name}
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
                        C{index + 1}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <RatingCard aspects={courtAspects} ratings={ratings} onChange={setRating} />
            </View>

            <View className="gap-2">
              <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">
                The club
              </Text>
              <RatingCard aspects={clubAspects} ratings={ratings} onChange={setRating} />
            </View>

            <View className="gap-2">
              <Text className="font-bold text-[14px] text-foreground">Anything stand out?</Text>
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
                        {tag.label}
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
      placeholder="Add a comment (optional)"
      accessibilityLabel="Comment"
      numberOfLines={3}
      className="min-h-20"
    />
  );
}

function RatingCard({
  aspects,
  ratings,
  onChange,
}: {
  aspects: string[];
  ratings: Record<string, number>;
  onChange: (aspect: string, value: number) => void;
}) {
  return (
    <View className="rounded-[20px] border border-line bg-surface px-3.5 py-0.5">
      {aspects.map((aspect, index) => (
        <View
          key={aspect}
          className={cn(
            "h-11 flex-row items-center justify-between",
            index < aspects.length - 1 && "border-b border-fill",
          )}
        >
          <Text className="font-bold text-[14px] text-foreground">{aspect}</Text>
          <StarRating
            label={aspect}
            value={ratings[aspect] ?? 0}
            onChange={(value) => onChange(aspect, value)}
          />
        </View>
      ))}
    </View>
  );
}
