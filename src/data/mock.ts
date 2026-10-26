// Mock data shared by the screens until the API exists. Dates are relative to today.
import type { Club } from "@/types/club";
import type { NextMatch, OpenMatch, PastMatch, PendingReview, UpcomingMatch } from "@/types/match";
import type { Player } from "@/types/player";

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

const players = {
  amine: { id: "p-amine", firstName: "Amine", lastName: "Khelifi" },
  mehdi: { id: "p-mehdi", firstName: "Mehdi", lastName: "Trabelsi" },
  sarra: { id: "p-sarra", firstName: "Sarra", lastName: "Hamdi" },
  karim: { id: "p-karim", firstName: "Karim", lastName: "Jaziri" },
  nour: { id: "p-nour", firstName: "Nour", lastName: "Saidi" },
  aziz: { id: "p-aziz", firstName: "Aziz", lastName: "Mansour" },
  ines: { id: "p-ines", firstName: "Ines", lastName: "Rekik" },
  omar: { id: "p-omar", firstName: "Omar", lastName: "Bouazizi" },
  rania: { id: "p-rania", firstName: "Rania", lastName: "Gharbi" },
  hedi: { id: "p-hedi", firstName: "Hedi", lastName: "Chaabane" },
} satisfies Record<string, Player>;

export const me: Player = { id: "p-youssef", firstName: "Youssef", lastName: "Ben Ali" };
export const myLevel = 4.5;
export const myCity = "Tunis";

export const upcomingMatches: UpcomingMatch[] = [
  {
    id: "match-1",
    startsAt: inDays(2, 18),
    clubName: "Lac Padel Arena",
    courtName: "Court 2",
    players: [me, players.amine, players.mehdi, players.sarra],
    capacity: 4,
    host: me,
  },
  {
    id: "match-8",
    startsAt: inDays(4, 20, 30),
    clubName: "Gammarth Padel",
    courtName: "Court 4",
    players: [players.karim, me, players.nour],
    capacity: 4,
    host: players.karim,
  },
];

export const nextMatch: NextMatch = upcomingMatches[0];

export const pendingReviews: PendingReview[] = [
  {
    matchId: "match-0",
    playedAt: inDays(-1, 19),
    clubName: "Gammarth Padel",
    closesAt: inDays(2, 23, 59),
  },
];

export const pastMatches: PastMatch[] = [
  {
    id: "match-past-1",
    playedAt: inDays(-7, 18),
    clubName: "Lac Padel Arena",
    won: true,
    sets: [
      [6, 4],
      [3, 6],
      [7, 5],
    ],
  },
  {
    id: "match-past-2",
    playedAt: inDays(-12, 20),
    clubName: "La Marsa Padel",
    won: false,
    sets: [
      [4, 6],
      [5, 7],
    ],
  },
];

export const openMatches: OpenMatch[] = [
  {
    id: "match-2",
    startsAt: inDays(0, 20),
    clubName: "Gammarth Padel",
    durationMinutes: 90,
    levelMin: 4,
    levelMax: 5,
    players: [players.karim, players.nour, players.aziz],
    capacity: 4,
    price: 20,
  },
  {
    id: "match-4",
    startsAt: inDays(0, 21, 30),
    clubName: "Lac Padel Arena",
    durationMinutes: 90,
    levelMin: 4,
    levelMax: 4.5,
    players: [players.ines, players.omar],
    capacity: 4,
    price: 25,
    isMixed: true,
  },
  {
    id: "match-5",
    startsAt: inDays(0, 22),
    clubName: "Ennasr Padel Club",
    durationMinutes: 60,
    levelMin: 5.5,
    levelMax: 6.5,
    players: [players.hedi, players.rania],
    capacity: 4,
    price: 30,
  },
  {
    id: "match-6",
    startsAt: inDays(0, 18, 30),
    clubName: "La Marsa Padel",
    durationMinutes: 90,
    levelMin: 3.5,
    levelMax: 4.5,
    players: [players.sarra, players.mehdi, players.amine],
    capacity: 4,
    price: 20,
  },
  {
    id: "match-7",
    startsAt: inDays(1, 19),
    clubName: "Gammarth Padel",
    durationMinutes: 90,
    levelMin: 4.5,
    levelMax: 5.5,
    players: [players.karim],
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
    players: [players.ines, players.omar],
    capacity: 4,
    price: 25,
  },
];

export const clubsNearby: Club[] = [
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
