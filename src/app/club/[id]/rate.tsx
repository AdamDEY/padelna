import { Button, cn, TextArea, useToast } from "heroui-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Page } from "@/components/page";
import { StarRating } from "@/components/star-rating";
import { clubReviewTagOptions, getClubDetails, pastMatches } from "@/data/mock";
import { formatMatchDay } from "@/lib/format-date";

const courtAspects = ["Court surface", "Glass & walls", "Lighting"];
const clubAspects = ["Rackets & balls", "Changing rooms", "Staff & welcome"];

export default function RateClub() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = getClubDetails(id);
  const { toast } = useToast();

  // Pre-fill the court and date from your latest match here
  const lastMatchHere = pastMatches.find((match) => match.clubName === club?.name);
  const courts = Array.from({ length: club?.courtCount ?? 0 }, (_, i) => `Court ${i + 1}`);

  const [court, setCourt] = useState(lastMatchHere?.courtName ?? null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<Set<string>>(() => new Set());
  const [comment, setComment] = useState("");

  if (!club) {
    return (
      <Page>
        <Page.Header back closeIcon />
        <Page.Body>
          <Page.Title>Club not found</Page.Title>
        </Page.Body>
      </Page>
    );
  }

  const hasRating = Object.values(ratings).some((value) => value > 0);

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

  function submit() {
    // Nothing is saved yet; the API will take the ratings, tags and comment
    toast.show({
      variant: "success",
      label: "Thanks for your review",
      description: `It helps other players choose ${club!.name}.`,
    });
    router.back();
  }

  const subtitle = lastMatchHere
    ? `${club.name} · ${formatMatchDay(lastMatchHere.playedAt)}`
    : club.name;

  return (
    <Page>
      <Stack.Screen options={{ presentation: "fullScreenModal" }} />
      <Page.Header
        back
        closeIcon
        leading={
          <>
            <Text
              accessibilityRole="header"
              className="font-black text-[22px] tracking-[-0.3px] text-foreground"
            >
              How was the club?
            </Text>
            <Text numberOfLines={1} className="font-normal text-[13px] text-muted">
              {subtitle}
            </Text>
          </>
        }
      />

      <Page.Body className="gap-4">
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
          <Text className="font-bold text-[12px] uppercase tracking-[0.6px] text-muted">The club</Text>
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

        <TextArea
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment (optional)"
          accessibilityLabel="Comment"
          numberOfLines={3}
          className="min-h-20"
        />
      </Page.Body>

      <Page.Footer>
        <Button size="lg" isDisabled={!hasRating} onPress={submit}>
          Submit
        </Button>
      </Page.Footer>
    </Page>
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
