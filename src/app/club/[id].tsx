import { Button, cn } from "heroui-native";
import { useLocalSearchParams } from "expo-router";
import { Star } from "lucide-react-native";
import { useState } from "react";
import { Linking, Platform, Pressable, Text, View } from "react-native";

import { ClubHero } from "@/components/club-hero";
import { ClubMatchRow } from "@/components/club-match-row";
import { ClubReviewCard } from "@/components/club-review-card";
import { ClubReviewsSummary } from "@/components/club-reviews-summary";
import { Icon } from "@/components/icon";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { getClubDetails, openMatches } from "@/data/mock";

// How far the white sheet slides up over the photo
const SHEET_OVERLAP = 34;

function openDirections(name: string, address: string) {
  const query = encodeURIComponent(`${name}, ${address}`);
  const url =
    Platform.OS === "ios" ? `https://maps.apple.com/?q=${query}` : `geo:0,0?q=${query}`;
  Linking.openURL(url).catch(() => {
    // No maps app; fall back to the web
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  });
}

export default function ClubDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const club = getClubDetails(id);
  const [isSaved, setIsSaved] = useState(false);

  if (!club) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body>
          <Page.Title description="This club may have closed or moved.">Club not found</Page.Title>
        </Page.Body>
      </Page>
    );
  }

  const hasReviews = club.reviewCount > 0;

  const matchesHere = openMatches
    .filter((match) => match.clubName === club.name)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const stats = [
    { value: String(club.courtCount), label: "Courts" },
    { value: `${club.indoorCourts} + ${club.outdoorCourts}`, label: "Indoor · outdoor" },
    { value: club.openUntil, label: "Open until" },
  ];

  return (
    <Page surface underStatusBar>
      <Page.Body className="gap-0 px-0">
        <ClubHero
          tint={club.placeholderTint}
          photoCount={club.photoCount}
          isSaved={isSaved}
          onToggleSave={() => setIsSaved((saved) => !saved)}
        />

        <View
          className="gap-[18px] rounded-t-[28px] bg-surface px-5 pt-[22px]"
          style={{ marginTop: -SHEET_OVERLAP }}
        >
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between gap-3">
              <Text
                accessibilityRole="header"
                className="flex-1 font-black text-[26px] tracking-[-0.4px] text-foreground"
              >
                {club.name}
              </Text>
              {hasReviews ? (
                <View
                  accessible
                  accessibilityLabel={`Rated ${club.rating.toFixed(1)} from ${club.reviewCount} reviews`}
                  className="flex-row items-center gap-1"
                >
                  <Icon as={Star} size={16} color="star" filled />
                  <Text className="font-bold text-[15px] text-foreground">
                    {club.rating.toFixed(1)}{" "}
                    <Text className="font-medium text-muted">({club.reviewCount})</Text>
                  </Text>
                </View>
              ) : null}
            </View>
            <Text className="font-normal text-[15px] text-muted">
              {club.address} · {club.distanceKm.toFixed(1)} km
            </Text>
          </View>

          <View className="flex-row gap-2.5">
            {stats.map((stat) => (
              <View
                key={stat.label}
                accessible
                accessibilityLabel={`${stat.label}: ${stat.value}`}
                className="flex-1 gap-0.5 rounded-2xl bg-background p-3"
              >
                <Text className="font-black text-[20px] text-foreground">{stat.value}</Text>
                <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap gap-2">
            {club.amenities.map((amenity) => (
              <Text
                key={amenity}
                className="overflow-hidden rounded-[14px] bg-out-of-range px-3 py-1.5 font-semibold text-[13px] text-ink-2"
              >
                {amenity}
              </Text>
            ))}
          </View>

          <View className="gap-2.5">
            <SectionHeader size="sm" title={`Open matches here · ${matchesHere.length}`} />
            {matchesHere.map((match) => (
              <ClubMatchRow key={match.id} match={match} />
            ))}
            {matchesHere.length === 0 ? (
              <Text className="font-normal text-[14px] text-muted">
                No open matches here right now. Create one and invite players.
              </Text>
            ) : null}
          </View>

          <View className="gap-3.5">
            <SectionHeader
              size="sm"
              title="Player reviews"
              actionLabel={hasReviews ? `See all ${club.reviewCount}` : undefined}
            />
            {hasReviews ? (
              <ClubReviewsSummary club={club} />
            ) : (
              <Text className="rounded-[20px] bg-background p-4 font-normal text-[14px] leading-5 text-muted">
                No reviews yet. Played here? Be the first to rate this club.
              </Text>
            )}

            <View className="flex-row flex-wrap gap-2">
              {club.reviewTags.map((tag) => (
                <Text
                  key={tag.label}
                  className={cn(
                    "overflow-hidden rounded-[14px] px-3 py-1.5 font-bold text-[13px]",
                    tag.negative ? "bg-attention-soft text-attention" : "bg-success-soft text-success",
                  )}
                >
                  {tag.label} · {tag.count}
                </Text>
              ))}
            </View>

            {club.latestReview ? <ClubReviewCard review={club.latestReview} /> : null}

            <Pressable
              accessibilityRole="button"
              className="h-12 flex-row items-center justify-center gap-2 rounded-[14px] border border-primary-outline"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Icon as={Star} size={18} color="accent" />
              <Text className="font-bold text-[15px] text-accent">Rate this club</Text>
            </Pressable>
          </View>
        </View>
      </Page.Body>

      <Page.Footer className="flex-row border-t border-line bg-surface">
        <Button
          size="lg"
          variant="secondary"
          onPress={() => openDirections(club.name, club.address)}
          className="flex-1"
        >
          Directions
        </Button>
        <Button size="lg" className="flex-[1.4]">
          Create match here
        </Button>
      </Page.Footer>
    </Page>
  );
}
