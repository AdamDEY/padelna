import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ClubRow } from "@/components/club-row";
import { ConnectionRequestsBanner } from "@/components/connection-requests-banner";
import { ConnectionRequestsSheet } from "@/components/connection-requests-sheet";
import { CreateMatchButton } from "@/components/create-match-button";
import { CreateMatchSheet } from "@/components/create-match-sheet";
import { HomeHeader } from "@/components/home-header";
import { NextMatchCard } from "@/components/next-match-card";
import { OpenMatchCard } from "@/components/open-match-card";
import { Page } from "@/components/page";
import { ScoreReminder } from "@/components/score-reminder";
import { SectionHeader } from "@/components/section-header";
import { clubsNearby, myLevel } from "@/data/mock";
import { myMatchesKey, openMatchesKey, useHomeOpenMatches, useMyUpcomingMatches } from "@/hooks/useMatches";
import { connectionRequestsKey, useConnectionRequests } from "@/hooks/usePlayers";
import { myProfileKey, useMyProfile } from "@/hooks/useMyProfile";
import { isPlayableFit, levelFit } from "@/lib/level-fit";
import { queryClient } from "@/lib/query-client";


// Width that shows about 1.5 cards on a phone (design.md)
const OPEN_MATCH_CARD_WIDTH = 248;

// Room under the last section so the floating Create match button never covers it
const FLOATING_BUTTON_SPACE = 72;

// Pull to refresh reloads everything Home shows that comes from Supabase
function refreshHome() {
  return Promise.all(
    [myProfileKey, myMatchesKey, openMatchesKey, connectionRequestsKey].map((queryKey) =>
      queryClient.refetchQueries({ queryKey }),
    ),
  );
}

export default function Home() {
  const { t } = useTranslation();
  const [isCreating, setIsCreating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const { data: requests = [] } = useConnectionRequests();
  const { data: profile } = useMyProfile();
  const level = profile?.level ?? myLevel;
  const { data: upcoming } = useMyUpcomingMatches();
  const nextMatch = upcoming?.[0];

  const { data: openMatches } = useHomeOpenMatches();
  // Open matches that suit your level, soonest first
  const matchesForYou = useMemo(
    () =>
      (openMatches ?? [])
        .filter((match) => isPlayableFit(levelFit(level, match.levelMin, match.levelMax)))
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    [openMatches, level],
  );

  return (
    <Page>
      <Page.Fixed>
        <HomeHeader
          player={profile?.player}
          level={profile?.level}
          city={profile?.city}
          hasUnreadNotifications
        />
      </Page.Fixed>
      <Page.Body onRefresh={refreshHome}>
        {requests.length > 0 ? (
          <ConnectionRequestsBanner requesters={requests} onReview={() => setIsReviewing(true)} />
        ) : null}

        {nextMatch ? (
          <NextMatchCard
            match={nextMatch}
            onPress={() => router.push({ pathname: "/match/[id]", params: { id: nextMatch.id } })}
          />
        ) : null}

        <View className="gap-3">
          <SectionHeader
            title={t("home.openMatchesTitle")}
            subtitle={t("home.aroundYourLevel", { level: level.toFixed(1) })}
            actionLabel={t("common.seeAll")}
          />
          <Page.Carousel itemWidth={OPEN_MATCH_CARD_WIDTH}>
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
          {openMatches !== undefined && matchesForYou.length === 0 ? (
            <Text className="font-normal text-[14px] text-muted">
              {t("home.noOpenMatches")}
            </Text>
          ) : null}
        </View>

        <View className="gap-2.5">
          <SectionHeader
            title={t("home.clubsNearby")}
            actionLabel={t("common.seeAll")}
            onPressAction={() => router.push("/clubs")}
          />
          {clubsNearby.map((club) => (
            <ClubRow
              key={club.id}
              club={club}
              onPress={() => router.push({ pathname: "/club/[id]", params: { id: club.id } })}
            />
          ))}
        </View>
        <View style={{ height: FLOATING_BUTTON_SPACE }} />
      </Page.Body>

      <CreateMatchButton onPress={() => setIsCreating(true)} />
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
