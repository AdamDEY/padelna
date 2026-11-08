import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { ClubRow } from "@/components/club-row";
import { ClubRowSkeleton } from "@/components/club-row-skeleton";
import { ConnectionRequestsBanner } from "@/components/connection-requests-banner";
import { ConnectionRequestsSheet } from "@/components/connection-requests-sheet";
import { CreateMatchButton } from "@/components/create-match-button";
import { CreateMatchSheet } from "@/components/create-match-sheet";
import { HomeHeader } from "@/components/home-header";
import { LoadError } from "@/components/load-error";
import { NextMatchCard } from "@/components/next-match-card";
import { OpenMatchCard } from "@/components/open-match-card";
import { OpenMatchCardSkeleton } from "@/components/open-match-card-skeleton";
import { OpenMatchesEmptyCard } from "@/components/open-matches-empty-card";
import { Page } from "@/components/page";
import { ScoreReminder } from "@/components/score-reminder";
import { SectionHeader } from "@/components/section-header";
import { TournamentCard } from "@/components/tournament-card";
import { myLevel } from "@/data/mock";
import { myMatchesKey, openMatchesKey, useHomeOpenMatches, useMyUpcomingMatches } from "@/hooks/useMatches";
import { useNearbyClubs } from "@/hooks/useClubs";
import { notificationsKey, useUnreadNotificationCount } from "@/hooks/useNotifications";
import { connectionRequestsKey, useConnectionRequests } from "@/hooks/usePlayers";
import { myProfileKey, useMyProfile } from "@/hooks/useMyProfile";
import { upcomingTournamentsKey, useUpcomingTournaments } from "@/hooks/useTournaments";
import { errorMessage } from "@/lib/error-message";
import { isPlayableFit, levelFit } from "@/lib/level-fit";
import { queryClient } from "@/lib/query-client";

// Width that shows about 1.5 cards on a phone (design.md)
const OPEN_MATCH_CARD_WIDTH = 248;

// Wide enough for a name and details, narrow enough that the next card peeks in
const TOURNAMENT_CARD_WIDTH = 330;

// Room under the last section so the floating Create match button never covers it
const FLOATING_BUTTON_SPACE = 72;

// Pull to refresh reloads everything Home shows that comes from Supabase
function refreshHome() {
  return Promise.all(
    [myProfileKey, myMatchesKey, openMatchesKey, connectionRequestsKey, notificationsKey, upcomingTournamentsKey].map((queryKey) =>
      queryClient.refetchQueries({ queryKey }),
    ),
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const { data: requests = [] } = useConnectionRequests();
  const unreadNotifications = useUnreadNotificationCount();
  const { data: profile } = useMyProfile();
  const level = profile?.level ?? myLevel;
  const upcomingQuery = useMyUpcomingMatches();
  const upcoming = upcomingQuery.data;
  const nextMatch = upcoming?.[0];

  const openMatchesQuery = useHomeOpenMatches();
  const openMatches = openMatchesQuery.data;
  const tournaments = useUpcomingTournaments().data ?? [];
  const nearby = useNearbyClubs();
  const { clubs: nearbyClubs, hasDistances } = nearby;
  // Open matches that suit your level, soonest first
  const matchesForYou = useMemo(
    () =>
      (openMatches ?? [])
        .filter((match) => isPlayableFit(levelFit(level, match.levelMin, match.levelMax)))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [openMatches, level],
  );

  // Nothing suits the level: the card below replaces the carousel and the floating button
  const hasNoOpenMatches = openMatches !== undefined && matchesForYou.length === 0;

  return (
    <Page>
      <Page.Fixed>
        <HomeHeader
          player={profile?.player}
          level={profile?.level}
          city={profile?.city}
          hasUnreadNotifications={unreadNotifications > 0}
          onPressNotifications={() => router.push("/notifications")}
        />
      </Page.Fixed>
      <Page.Body onRefresh={refreshHome}>
        {requests.length > 0 ? (
          <ConnectionRequestsBanner requesters={requests} onReview={() => setIsReviewing(true)} />
        ) : null}

        {tournaments.length === 1 ? (
          <TournamentCard tournament={tournaments[0]} />
        ) : tournaments.length > 1 ? (
          <Page.Carousel itemWidth={TOURNAMENT_CARD_WIDTH}>
            {tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} width={TOURNAMENT_CARD_WIDTH} />
            ))}
          </Page.Carousel>
        ) : null}

        {nextMatch ? (
          <NextMatchCard
            match={nextMatch}
            onPress={() => router.push({ pathname: "/match/[id]", params: { id: nextMatch.id } })}
          />
        ) : upcomingQuery.error && !upcoming ? (
          <LoadError
            message={t("home.nextMatchFailed", { message: errorMessage(upcomingQuery.error) })}
            onRetry={() => upcomingQuery.refetch()}
            isRetrying={upcomingQuery.isRefetching}
          />
        ) : null}

        <View className="gap-3">
          <SectionHeader
            title={t("home.openMatchesTitle")}
            subtitle={t("home.aroundYourLevel", { level: level.toFixed(1) })}
            actionLabel={hasNoOpenMatches ? undefined : t("common.seeAll")}
          />
          <Page.Carousel itemWidth={OPEN_MATCH_CARD_WIDTH}>
            {openMatchesQuery.isLoading ? (
              <View accessible accessibilityLabel={t("matches.loading")} accessibilityState={{ busy: true }} className="flex-row gap-3">
                <OpenMatchCardSkeleton width={OPEN_MATCH_CARD_WIDTH} />
                <OpenMatchCardSkeleton width={OPEN_MATCH_CARD_WIDTH} />
              </View>
            ) : null}
            {matchesForYou.map((match) => (
              <OpenMatchCard
                key={match.id}
                match={match}
                width={OPEN_MATCH_CARD_WIDTH}
                onPress={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
                onJoin={() => router.push({ pathname: "/match/[id]", params: { id: match.id } })}
              />
            ))}
          </Page.Carousel>
          {openMatchesQuery.error && !openMatches ? (
            <LoadError
              message={t("home.openMatchesFailed", { message: errorMessage(openMatchesQuery.error) })}
              onRetry={() => openMatchesQuery.refetch()}
              isRetrying={openMatchesQuery.isRefetching}
            />
          ) : null}
          {hasNoOpenMatches ? (
            <OpenMatchesEmptyCard
              player={profile?.player}
              level={level}
              onCreate={() => setIsCreating(true)}
            />
          ) : null}
        </View>

        <View className="gap-2.5">
          <SectionHeader
            title={t(hasDistances ? "home.clubsNearby" : "home.clubs")}
            actionLabel={t("common.seeAll")}
            onPressAction={() => router.push("/clubs")}
          />
          {nearby.isLoading ? <ClubRowSkeleton label={t("home.loadingClubs")} /> : null}
          {nearbyClubs.map((club) => (
            <ClubRow
              key={club.id}
              club={club}
              onPress={() => router.push({ pathname: "/club/[id]", params: { id: club.id } })}
            />
          ))}
          {nearby.error ? (
            <LoadError
              message={t("home.clubsFailed", { message: errorMessage(nearby.error) })}
              onRetry={() => nearby.refetch()}
              isRetrying={nearby.isRefetching}
            />
          ) : null}
        </View>
        <View style={{ height: FLOATING_BUTTON_SPACE }} />
      </Page.Body>

      {hasNoOpenMatches ? null : <CreateMatchButton onPress={() => setIsCreating(true)} />}
      <CreateMatchSheet isOpen={isCreating} onOpenChange={setIsCreating} />
      <ConnectionRequestsSheet
        requests={requests}
        isOpen={isReviewing}
        onOpenChange={setIsReviewing}
      />
      <ScoreReminder />
    </Page>
  );
}
