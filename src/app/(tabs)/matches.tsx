import { router } from "expo-router";
import { Button, Spinner, Tabs } from "heroui-native";
import { CalendarDays, SlidersHorizontal } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";

import { DateStrip } from "@/components/date-strip";
import { FilterChip } from "@/components/filter-chip";
import { IconButton } from "@/components/icon-button";
import { MatchListItem } from "@/components/match-list-item";
import { Page } from "@/components/page";
import { PastMatchRow } from "@/components/past-match-row";
import { RateResultBanner } from "@/components/rate-result-banner";
import { SectionHeader } from "@/components/section-header";
import { UpcomingMatchCard } from "@/components/upcoming-match-card";
import { myLevel, pastMatches, pendingReviews } from "@/data/mock";
import { useMyUpcomingMatches, useOpenMatches } from "@/hooks/useMatches";
import { useMyAccount, useMyProfile } from "@/hooks/useMyProfile";
import { daysUntil, formatMatchDay } from "@/lib/format-date";
import { compareByFit, isPlayableFit, levelFit } from "@/lib/level-fit";

type Segment = "open" | "mine";

const filters = [
  { id: "my-level", label: "My level" },
  { id: "any-time", label: "Any time" },
  { id: "my-clubs", label: "My clubs" },
  { id: "friendly", label: "Friendly" },
] as const;

type FilterId = (typeof filters)[number]["id"];

function dayLabel(date: Date) {
  const days = daysUntil(date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${formatMatchDay(date)}`;
}

export default function Matches() {
  const [segment, setSegment] = useState<Segment>("open");

  return (
    <Page>
      <Page.Body>
        <Page.Title
          action={
            segment === "open" ? (
              <IconButton icon={SlidersHorizontal} label="Filters" />
            ) : (
              <IconButton icon={CalendarDays} label="Calendar view" />
            )
          }
        >
          Matches
        </Page.Title>

        <Tabs value={segment} onValueChange={(value) => setSegment(value as Segment)}>
          <Tabs.List className="bg-track">
            <Tabs.Indicator />
            <Tabs.Trigger value="open" className="flex-1">
              <Tabs.Label>Open matches</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="mine" className="flex-1">
              <Tabs.Label>My matches</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>

        {segment === "open" ? <OpenMatches /> : <MyMatches />}
      </Page.Body>
    </Page>
  );
}

function OpenMatches() {
  const [today] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(today);
  const [activeFilters, setActiveFilters] = useState<Set<FilterId>>(() => new Set(["my-level"]));
  const { data: profile } = useMyProfile();
  const level = profile?.level ?? myLevel;

  const dayStart = useMemo(
    () => new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate()),
    [selectedDay],
  );
  const dayEnd = useMemo(
    () => new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1),
    [dayStart],
  );
  const { data: openMatches, error, refetch, isRefetching } = useOpenMatches(dayStart, dayEnd);

  function toggleFilter(id: FilterId) {
    setActiveFilters((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // "My level" and "Friendly" filter for now; "Any time" and "My clubs" need more data
  const matches = useMemo(
    () =>
      (openMatches ?? [])
        .map((match) => ({ ...match, fit: levelFit(level, match.levelMin, match.levelMax) }))
        .filter((match) => !activeFilters.has("my-level") || isPlayableFit(match.fit))
        .filter((match) => !activeFilters.has("friendly") || match.kind === "friendly")
        .sort(compareByFit),
    [openMatches, level, activeFilters],
  );

  return (
    <>
      <DateStrip start={today} selected={selectedDay} onSelect={setSelectedDay} />

      <Page.Carousel gap={8}>
        {filters.map((filter) => (
          <FilterChip
            key={filter.id}
            label={filter.label}
            selected={activeFilters.has(filter.id)}
            onPress={() => toggleFilter(filter.id)}
          />
        ))}
      </Page.Carousel>

      <View className="gap-3">
        <Text className="font-semibold text-[13px] text-muted">
          {matches.length} {matches.length === 1 ? "match" : "matches"} {dayLabel(selectedDay)} · sorted
          by fit
        </Text>

        {matches.map((match) => (
          <MatchListItem
            key={match.id}
            match={match}
            fit={match.fit}
            onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
            onAskToJoin={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
          />
        ))}

        {error ? (
          <View className="items-start gap-2">
            <Text className="font-normal text-[14px] text-muted">
              Couldn’t load matches. {error.message}
            </Text>
            <Button size="sm" variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
              Try again
            </Button>
          </View>
        ) : openMatches === undefined ? (
          <Spinner accessibilityLabel="Loading matches" className="self-start" />
        ) : null}

        {openMatches !== undefined && matches.length === 0 ? (
          <View className="items-center gap-1 rounded-[20px] border border-line bg-surface p-6">
            <Text className="font-bold text-[15px] text-foreground">No open matches yet</Text>
            <Text className="text-center font-normal text-[14px] text-muted">
              Try another day, or switch off a filter.
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

function MyMatches() {
  const { data: account } = useMyAccount();
  const { data: upcomingMatches, error, refetch, isRefetching } = useMyUpcomingMatches();

  return (
    <>
      {pendingReviews.map((review) => (
        <RateResultBanner key={review.matchId} review={review} />
      ))}

      <View className="gap-2.5">
        <SectionHeader size="sm" title={`Upcoming · ${upcomingMatches?.length ?? 0}`} />
        {account
          ? upcomingMatches?.map((match) => (
              <UpcomingMatchCard
                key={match.id}
                match={match}
                me={{ id: account.id, firstName: account.firstName, lastName: account.lastName }}
                onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
              />
            ))
          : null}
        {error ? (
          <View className="items-start gap-2">
            <Text className="font-normal text-[14px] text-muted">
              Couldn’t load your matches. {error.message}
            </Text>
            <Button size="sm" variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
              Try again
            </Button>
          </View>
        ) : upcomingMatches === undefined ? (
          <Spinner accessibilityLabel="Loading your matches" className="self-start" />
        ) : upcomingMatches.length === 0 ? (
          <Text className="font-normal text-[14px] text-muted">
            No matches planned. Join an open match or create one.
          </Text>
        ) : null}
      </View>

      <View className="gap-2">
        <SectionHeader size="sm" title="Past" actionLabel="History" />
        {pastMatches.map((match) => (
          <PastMatchRow key={match.id} match={match} />
        ))}
      </View>
    </>
  );
}
