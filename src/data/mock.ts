// Mock data shared by the screens until the API exists. Dates are relative to today.
import type {
  MatchDetails,
  NextMatch,
  OpenMatch,
  PastMatch,
  UpcomingMatch,
} from "@/types/match";
import type { Player, PlayerStats } from "@/types/player";
import type { PlayerProfile } from "@/types/profile";
import type { ResultPost } from "@/types/post";

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
  karim: { id: "p-karim", firstName: "Karim", lastName: "Jaziri", level: 4.5 },
  nour: { id: "p-nour", firstName: "Nour", lastName: "Saidi", level: 4 },
  aziz: { id: "p-aziz", firstName: "Aziz", lastName: "Mansour", level: 5 },
  ines: { id: "p-ines", firstName: "Ines", lastName: "Rekik", level: 4 },
  omar: { id: "p-omar", firstName: "Omar", lastName: "Bouazizi", level: 4.5 },
  rania: { id: "p-rania", firstName: "Rania", lastName: "Gharbi" },
  hedi: { id: "p-hedi", firstName: "Hedi", lastName: "Chaabane" },
  amira: { id: "p-amira", firstName: "Amira", lastName: "Kefi" },
  salma: { id: "p-salma", firstName: "Salma", lastName: "Haddad" },
  nader: { id: "p-nader", firstName: "Nader", lastName: "Sassi" },
  sami: {
    id: "p-sami",
    firstName: "Sami",
    lastName: "Belhaj",
    level: 4.5,
    city: "Tunis",
    mutualFriendCount: 2,
  },
  wael: {
    id: "p-wael",
    firstName: "Wael",
    lastName: "Mejri",
    level: 5,
    city: "La Marsa",
    mutualFriendCount: 1,
  },
  leila: { id: "p-leila", firstName: "Leila", lastName: "Gabsi", level: 4.5, city: "Ariana" },
  rami: { id: "p-rami", firstName: "Rami", lastName: "Toumi", level: 4.5, city: "Tunis" },
  yasmine: { id: "p-yasmine", firstName: "Yasmine", lastName: "Ayari" },
  fares: { id: "p-fares", firstName: "Fares", lastName: "Zouari" },
  anis: { id: "p-anis", firstName: "Anis", lastName: "Ben Salah" },
  mourad: { id: "p-mourad", firstName: "Mourad", lastName: "Jlassi" },
  hamza: { id: "p-hamza", firstName: "Hamza", lastName: "Trabelsi", level: 4.5, city: "Tunis" },
  malek: { id: "p-malek", firstName: "Malek", lastName: "Bouzid", level: 4, city: "Sfax" },
  raniaK: {
    id: "p-rania-k",
    firstName: "Rania",
    lastName: "Karray",
    level: 4,
    city: "Tunis",
    mutualFriendCount: 1,
  },
} satisfies Record<string, Player>;

export const myLevel = 4.5;
export const me: Player = { id: "p-youssef", firstName: "Youssef", lastName: "Ben Ali", level: myLevel };
export const myCity = "Tunis";

/** Your account details and settings, for the Edit profile screen */
export const myAccount = {
  phone: "20 123 456",
  email: "youssef@example.com",
  bio: "Weekend player, love long rallies. Always up for a game.",
  hand: "right" as const,
  side: "right" as const,
  playStyle: "balanced" as const,
  matchVisibility: "Friends",
  language: "English",
};

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

export const pastMatches: PastMatch[] = [
  {
    id: "match-past-1",
    playedAt: inDays(-7, 18),
    clubName: "Lac Padel Arena",
    courtName: "Court 2",
    kind: "competitive",
    opponents: [],
    result: "won",
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
    kind: "friendly",
    opponents: [],
    result: "lost",
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
    isCourtBooked: true,
    courtName: "Court 3",
    host: players.karim,
    kind: "friendly",
    audience: "Men",
    note: "Relaxed game, good vibes. Balls are on me.",
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
    isCourtBooked: true,
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

/** Cities a player can pick in profile setup */
export const cities = [
  "Tunis",
  "Ariana",
  "Ben Arous",
  "La Marsa",
  "Nabeul",
  "Hammamet",
  "Sousse",
  "Monastir",
  "Sfax",
  "Bizerte",
];

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 3_600_000);
}

export const communityPosts: ResultPost[] = [
  {
    id: "post-1",
    postedAt: hoursAgo(1),
    playedAt: hoursAgo(3),
    clubName: "Lac Padel Arena",
    courtName: "Court 2",
    kind: "friendly",
    levelMin: 4,
    levelMax: 5,
    teams: [
      [me, players.amira],
      [players.mehdi, players.salma],
    ],
    sets: [
      [6, 4],
      [3, 6],
      [7, 5],
    ],
    confirmed: true,
  },
  {
    id: "post-2",
    postedAt: hoursAgo(2),
    playedAt: hoursAgo(4),
    clubName: "Gammarth Padel",
    courtName: "Court 1",
    kind: "competitive",
    levelMin: 4,
    levelMax: 5,
    teams: [
      [players.karim, players.nader],
      [players.aziz, players.omar],
    ],
    sets: [
      [6, 4],
      [3, 6],
      [7, 5],
    ],
    confirmed: true,
    // Stand-in photo until real uploads exist
    photoUri: "https://picsum.photos/seed/padelna-team/800/480",
  },
];

/** Clubs you play at, for the Community "My clubs" tab */
export const myClubNames = ["Lac Padel Arena", "Gammarth Padel"];

export const clubsThisWeek = { matchesPlayed: 23, openForYourLevel: 4 };

export const clubPosts: ResultPost[] = [
  {
    id: "post-club-1",
    postedAt: hoursAgo(3),
    playedAt: hoursAgo(5),
    clubName: "Lac Padel Arena",
    courtName: "Court 3",
    kind: "friendly",
    levelMin: 4.5,
    levelMax: 5,
    teams: [
      [players.sami, players.wael],
      [players.leila, players.rami],
    ],
    sets: [
      [6, 3],
      [6, 4],
    ],
    confirmed: true,
    mutualFriendCount: 2,
    photoUri: "https://picsum.photos/seed/padelna-club/800/480",
  },
  {
    id: "post-club-2",
    postedAt: hoursAgo(6),
    playedAt: hoursAgo(8),
    clubName: "Gammarth Padel",
    courtName: "Court 2",
    kind: "competitive",
    levelMin: 4,
    levelMax: 4.5,
    teams: [
      [players.hamza, players.raniaK],
      [players.malek, players.anis],
    ],
    sets: [
      [7, 5],
      [4, 6],
      [6, 4],
    ],
    confirmed: true,
    mutualFriendCount: 1,
  },
];

export const tunisiaCities = ["Tunis", "Sousse", "Sfax", "Hammamet"];

export const risingPlayers = [
  { player: players.yasmine, levelChange: 0.4, city: "Sousse" },
  { player: players.hamza, levelChange: 0.3, city: "Tunis" },
  { player: players.malek, levelChange: 0.3, city: "Sfax" },
  { player: players.raniaK, levelChange: 0.2, city: "Tunis" },
];

export const tunisiaPosts: ResultPost[] = [
  {
    id: "post-tn-1",
    postedAt: hoursAgo(5),
    playedAt: hoursAgo(7),
    clubName: "Sousse Padel Center",
    courtName: "Court 1",
    city: "Sousse",
    kind: "competitive",
    levelMin: 4.5,
    levelMax: 5.5,
    teams: [
      [players.yasmine, players.fares],
      [players.anis, players.mourad],
    ],
    sets: [
      [5, 7],
      [6, 2],
      [6, 3],
    ],
    confirmed: false,
  },
  {
    id: "post-tn-2",
    postedAt: hoursAgo(9),
    playedAt: hoursAgo(11),
    clubName: "Sfax Padel Club",
    courtName: "Court 4",
    city: "Sfax",
    kind: "friendly",
    levelMin: 3.5,
    levelMax: 4.5,
    teams: [
      [players.malek, players.hedi],
      [players.rania, players.omar],
    ],
    sets: [
      [6, 4],
      [6, 4],
    ],
    confirmed: true,
  },
];

/** Players you are already friends with */
export const myFriendIds = new Set<string>([players.rami.id, players.anis.id]);

openMatches.push({
  id: "match-9",
  startsAt: nextWeekday(6, 9),
  clubName: "Lac Padel Arena",
  durationMinutes: 90,
  levelMin: 4.5,
  levelMax: 5.5,
  players: [players.sami, players.wael, players.leila],
  capacity: 4,
  price: 25,
  isCourtBooked: false,
});

/** The signed-in player's profile */
export const myProfile: PlayerProfile = {
  player: me,
  city: myCity,
  side: "right",
  playStyle: "balanced",
  level: myLevel,
  progressToNext: 0.62,
  nextLevelHint: { wins: 6, opponentLevel: 4.5 },
  matchesPlayed: 32,
  reviewCount: 14,
  winRate: 59,
  streak: "W3",
  friendCount: 48,
  levelHistory: [
    { month: "May", level: 4.0 },
    { month: "Jun", level: 4.1 },
    { month: "Jul", level: 4.1 },
    { month: "Aug", level: 4.25 },
    { month: "Sep", level: 4.35 },
    { month: "Oct", level: 4.5 },
  ],
  winRates: [
    {
      title: "By side",
      stats: [
        { label: "Right side", winRate: 68 },
        { label: "Left side", winRate: 41 },
      ],
    },
    {
      title: "By opponent level",
      stats: [
        { label: "Lower than you", winRate: 82 },
        { label: "Same level", winRate: 58 },
        { label: "Higher than you", winRate: 36 },
      ],
    },
    {
      title: "By set",
      stats: [
        { label: "First set", winRate: 63 },
        { label: "Third set", winRate: 29 },
      ],
    },
  ],
  bestPartners: [
    { player: players.amira, matches: 9, wins: 7 },
    { player: players.karim, matches: 6, wins: 4 },
    { player: players.mehdi, matches: 4, wins: 2 },
  ],
  reputationTags: [
    { label: "Fair play", count: 12 },
    { label: "On time", count: 11 },
    { label: "Great teammate", count: 9 },
    { label: "Solid at the net", count: 6 },
  ],
};

/** Players whose level is still settling (few matches played) */
export const newPlayerIds = new Set<string>([players.aziz.id]);

/** One match by id, from the open matches or your own upcoming ones */
export function getMatchDetails(id: string): MatchDetails | undefined {
  const open = openMatches.find((match) => match.id === id);
  if (open) {
    return {
      id: open.id,
      startsAt: open.startsAt,
      durationMinutes: open.durationMinutes,
      clubName: open.clubName,
      courtName: open.courtName,
      isCourtBooked: open.isCourtBooked ?? false,
      levelMin: open.levelMin,
      levelMax: open.levelMax,
      kind: open.kind ?? "friendly",
      audience: open.audience ?? (open.isMixed ? "Mixed" : undefined),
      players: open.players,
      capacity: open.capacity,
      price: open.price,
      host: open.host ?? open.players[0],
      note: open.note,
    };
  }
  const upcoming = upcomingMatches.find((match) => match.id === id);
  if (upcoming) {
    return {
      id: upcoming.id,
      startsAt: upcoming.startsAt,
      durationMinutes: 90,
      clubName: upcoming.clubName,
      courtName: upcoming.courtName,
      isCourtBooked: true,
      kind: "friendly",
      players: upcoming.players,
      capacity: upcoming.capacity,
      host: upcoming.host,
    };
  }
  return undefined;
}

// Another player's results and reviews aren't stored yet, so every profile shows these
export const mockPlayerStats: PlayerStats = {
  matches: 48,
  won: 30,
  lost: 18,
  reviews: 22,
  tags: [
    { label: "Fair play", count: 18 },
    { label: "On time", count: 15 },
    { label: "Strong smash", count: 11 },
    { label: "Great teammate", count: 7 },
  ],
  asPartners: { won: 1, lost: 0 },
  asOpponents: { won: 0, lost: 1 },
};
