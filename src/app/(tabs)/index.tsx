import { View } from "react-native";

import { ClubRow } from "@/components/club-row";
import { HomeHeader } from "@/components/home-header";
import { NextMatchCard, type NextMatch } from "@/components/next-match-card";
import { OpenMatchCard, type OpenMatch } from "@/components/open-match-card";
import { Page } from "@/components/page";
import { SectionHeader } from "@/components/section-header";
import type { Club } from "@/types/club";
import type { Player } from "@/types/player";

// Mock data until the API exists
function inDays(days: number, hours: number, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function nextWeekday(weekday: number, hours: number) {
  const today = new Date().getDay();
  return inDays((weekday - today + 7) % 7 || 7, hours);
}

const me: Player = { id: "p-youssef", firstName: "Youssef", lastName: "Ben Ali" };

const nextMatch: NextMatch = {
  id: "match-1",
  startsAt: inDays(2, 18),
  clubName: "Lac Padel Arena",
  courtName: "Court 2",
  players: [
    me,
    { id: "p-amine", firstName: "Amine", lastName: "Khelifi" },
    { id: "p-mehdi", firstName: "Mehdi", lastName: "Trabelsi" },
    { id: "p-sarra", firstName: "Sarra", lastName: "Hamdi" },
  ],
};

const myLevel = 4.5;

const openMatches: OpenMatch[] = [
  {
    id: "match-2",
    startsAt: inDays(0, 20),
    clubName: "Gammarth Padel",
    durationMinutes: 90,
    levelMin: 4,
    levelMax: 5,
    players: [
      { id: "p-karim", firstName: "Karim", lastName: "Jaziri" },
      { id: "p-nour", firstName: "Nour", lastName: "Saidi" },
      { id: "p-aziz", firstName: "Aziz", lastName: "Mansour" },
    ],
    capacity: 4,
    price: 20,
  },
  {
    id: "match-3",
    startsAt: nextWeekday(0, 10),
    clubName: "La Marsa Padel",
    durationMinutes: 90,
    levelMin: 4,
    levelMax: 4.5,
    players: [
      { id: "p-ines", firstName: "Ines", lastName: "Rekik" },
      { id: "p-omar", firstName: "Omar", lastName: "Bouazizi" },
    ],
    capacity: 4,
    price: 25,
  },
];

const clubsNearby: Club[] = [
  {
    id: "club-lac",
    name: "Lac Padel Arena",
    distanceKm: 2.1,
    courtCount: 6,
    openMatchCount: 3,
    placeholderTint: "green",
  },
  {
    id: "club-gammarth",
    name: "Gammarth Padel",
    distanceKm: 6.4,
    courtCount: 4,
    openMatchCount: 1,
    placeholderTint: "blue",
  },
  {
    id: "club-marsa",
    name: "La Marsa Padel",
    distanceKm: 8.9,
    courtCount: 5,
    openMatchCount: 2,
    placeholderTint: "peach",
  },
];

// Width that shows about 1.5 cards on a phone (design.md)
const OPEN_MATCH_CARD_WIDTH = 248;

export default function Home() {
  return (
    <Page>
      <Page.Body>
        <HomeHeader player={me} level={myLevel} city="Tunis" hasUnreadNotifications />
        <NextMatchCard match={nextMatch} />

        <View className="gap-3">
          <SectionHeader
            title="Open matches for you"
            subtitle={`Around your level ${myLevel.toFixed(1)}`}
            actionLabel="See all"
          />
          <Page.Carousel itemWidth={OPEN_MATCH_CARD_WIDTH}>
            {openMatches.map((match) => (
              <OpenMatchCard key={match.id} match={match} width={OPEN_MATCH_CARD_WIDTH} />
            ))}
          </Page.Carousel>
        </View>

        <View className="gap-2.5">
          <SectionHeader title="Clubs near you" actionLabel="Map" />
          {clubsNearby.map((club) => (
            <ClubRow key={club.id} club={club} />
          ))}
        </View>
      </Page.Body>
    </Page>
  );
}
