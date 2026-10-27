import { router } from "expo-router";
import { View } from "react-native";

import { ClubRow } from "@/components/club-row";
import { HomeHeader } from "@/components/home-header";
import { NextMatchCard } from "@/components/next-match-card";
import { OpenMatchCard } from "@/components/open-match-card";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import { clubsNearby, me, myCity, myLevel, nextMatch, openMatches } from "@/data/mock";
import { isPlayableFit, levelFit } from "@/lib/level-fit";

// Open matches that suit your level, soonest first
const matchesForYou = openMatches
  .filter((match) => isPlayableFit(levelFit(myLevel, match.levelMin, match.levelMax)))
  .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

// Width that shows about 1.5 cards on a phone (design.md)
const OPEN_MATCH_CARD_WIDTH = 248;

export default function Home() {
  return (
    <Page>
      <Page.Body>
        <HomeHeader player={me} level={myLevel} city={myCity} hasUnreadNotifications />
        <NextMatchCard match={nextMatch} />

        <View className="gap-3">
          <SectionHeader
            title="Open matches for you"
            subtitle={`Around your level ${myLevel.toFixed(1)}`}
            actionLabel="See all"
          />
          <Page.Carousel itemWidth={OPEN_MATCH_CARD_WIDTH}>
            {matchesForYou.map((match) => (
              <OpenMatchCard key={match.id} match={match} width={OPEN_MATCH_CARD_WIDTH} />
            ))}
          </Page.Carousel>
        </View>

        <View className="gap-2.5">
          <SectionHeader
            title="Clubs near you"
            actionLabel="See all"
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
      </Page.Body>
    </Page>
  );
}
