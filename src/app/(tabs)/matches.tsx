import { router } from "expo-router";
import { t } from "i18next";
import { Button, Spinner, Tabs } from "heroui-native";
import { CalendarDays, SlidersHorizontal } from "lucide-react-native";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { myLevel } from "@/data/mock";
import {
  myMatchesKey,
  openMatchesKey,
  pendingScoresKey,
  useMyPastMatches,
  useMyUpcomingMatches,
  useOpenMatches,
  usePendingScores,
} from "@/hooks/useMatches";
import { useMyAccount, useMyProfile } from "@/hooks/useMyProfile";
import { daysUntil, formatMatchDay } from "@/lib/format-date";
import { compareByFit, isPlayableFit, levelFit } from "@/lib/level-fit";
import { queryClient } from "@/lib/query-client";

type Segment = "open" | "mine";

const filters = [
  { id: "my-level", label: "matches.filterMyLevel" },
  { id: "any-time", label: "matches.filterAnyTime" },
  { id: "my-clubs", label: "matches.filterMyClubs" },
  { id: "friendly", label: "match.kind.friendly" },
] as const;

type FilterId = (typeof filters)[number]["id"];

function dayLabel(date: Date) {
  const days = daysUntil(date);
  if (days === 0) return t("matches.dayToday");
  if (days === 1) return t("matches.dayTomorrow");
  return t("matches.dayOn", { date: formatMatchDay(date) });
}

// Pull to refresh reloads both lists, whichever tab you're on
function refreshMatches() {
  return Promise.all(
    [openMatchesKey, myMatchesKey, pendingScoresKey].map((queryKey) => queryClient.refetchQueries({ queryKey })),
  );
}

export default function Matches() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>("open");

  return (
    <Page>
      {/* The title and the Open / My matches switch stay put while the lists scroll */}
      <Page.Fixed className="gap-5">
        <Page.Title
          action={
            segment === "open" ? (
              <IconButton icon={SlidersHorizontal} label={t("matches.filters")} />
            ) : (
              <IconButton icon={CalendarDays} label={t("matches.calendar")} />
            )
          }
        >
          {t("matches.title")}
        </Page.Title>

        <Tabs value={segment} onValueChange={(value) => setSegment(value as Segment)}>
          <Tabs.List className="bg-track">
            <Tabs.Indicator />
            <Tabs.Trigger value="open" className="flex-1">
              <Tabs.Label>{t("matches.tabOpen")}</Tabs.Label>
            </Tabs.Trigger>
            <Tabs.Trigger value="mine" className="flex-1">
              <Tabs.Label>{t("matches.tabMine")}</Tabs.Label>
            </Tabs.Trigger>
          </Tabs.List>
        </Tabs>
      </Page.Fixed>

      <Page.Body onRefresh={refreshMatches}>
        {segment === "open" ? <OpenMatches /> : <MyMatches />}
      </Page.Body>
    </Page>
  );
}

function OpenMatches() {
  const { t } = useTranslation();
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
            label={t(filter.label)}
            selected={activeFilters.has(filter.id)}
            onPress={() => toggleFilter(filter.id)}
          />
        ))}
      </Page.Carousel>

      <View className="gap-3">
        <Text className="font-semibold text-[13px] text-muted">
          {t("matches.count", { count: matches.length, day: dayLabel(selectedDay) })}
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
              {t("matches.loadFailed", { message: error.message })}
            </Text>
            <Button size="sm" variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
              {t("matches.tryAgain")}
            </Button>
          </View>
        ) : openMatches === undefined ? (
          <Spinner accessibilityLabel={t("matches.loading")} className="self-start" />
        ) : null}

        {openMatches !== undefined && matches.length === 0 ? (
          <View className="items-center gap-1 rounded-[20px] border border-line bg-surface p-6">
            <Text className="font-bold text-[15px] text-foreground">{t("matches.emptyTitle")}</Text>
            <Text className="text-center font-normal text-[14px] text-muted">
              {t("matches.emptyText")}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );
}

function MyMatches() {
  const { t } = useTranslation();
  const { data: account } = useMyAccount();
  const { data: upcomingMatches, error, refetch, isRefetching } = useMyUpcomingMatches();
  const { data: pendingScores = [] } = usePendingScores();
  const { data: pastMatches } = useMyPastMatches();

  return (
    <>
      {pendingScores.map((review) => (
        <RateResultBanner
          key={review.matchId}
          review={review}
          onPress={() =>
            router.push({ pathname: "/match/[id]", params: { id: review.matchId } })
          }
        />
      ))}

      <View className="gap-2.5">
        <SectionHeader size="sm" title={t("matches.upcoming", { count: upcomingMatches?.length ?? 0 })} />
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
              {t("matches.loadMineFailed", { message: error.message })}
            </Text>
            <Button size="sm" variant="secondary" onPress={() => refetch()} isDisabled={isRefetching}>
              {t("matches.tryAgain")}
            </Button>
          </View>
        ) : upcomingMatches === undefined ? (
          <Spinner accessibilityLabel={t("matches.loadingMine")} className="self-start" />
        ) : upcomingMatches.length === 0 ? (
          <Text className="font-normal text-[14px] text-muted">
            {t("matches.noUpcoming")}
          </Text>
        ) : null}
      </View>

      <View className="gap-2">
        <SectionHeader size="sm" title={t("matches.past")} actionLabel={t("matches.history")} />
        {pastMatches?.map((match) => (
          <PastMatchRow
            key={match.id}
            match={match}
            onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
          />
        ))}
        {pastMatches === undefined ? (
          <Spinner accessibilityLabel={t("matches.loadingPast")} className="self-start" />
        ) : pastMatches.length === 0 ? (
          <Text className="font-normal text-[14px] text-muted">
            {t("matches.noPast")}
          </Text>
        ) : null}
      </View>
    </>
  );
}
