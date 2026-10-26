// Mock data shared by the screens until the API exists. Dates are relative to today.
import type { Club, ClubDetails } from "@/types/club";
import type { NextMatch, OpenMatch, PastMatch, PendingReview, UpcomingMatch } from "@/types/match";
import type { Player } from "@/types/player";
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
  karim: { id: "p-karim", firstName: "Karim", lastName: "Jaziri" },
  nour: { id: "p-nour", firstName: "Nour", lastName: "Saidi" },
  aziz: { id: "p-aziz", firstName: "Aziz", lastName: "Mansour" },
  ines: { id: "p-ines", firstName: "Ines", lastName: "Rekik" },
  omar: { id: "p-omar", firstName: "Omar", lastName: "Bouazizi" },
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
    courtName: "Court 2",
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

/** Every club in the app, for the All clubs screen */
export const allClubs: Club[] = [
  {
    id: "club-lac",
    name: "Lac Padel Arena",
    area: "Les Berges du Lac",
    region: "Tunis",
    distanceKm: 2.1,
    courtCount: 6,
    openMatchCount: 0,
    rating: 4.6,
    placeholderTint: "green",
    isMyClub: true,
  },
  {
    id: "club-gammarth",
    name: "Gammarth Padel",
    area: "Gammarth",
    region: "Tunis",
    distanceKm: 6.4,
    courtCount: 4,
    openMatchCount: 0,
    rating: 4.3,
    placeholderTint: "blue",
    isMyClub: true,
  },
  {
    id: "club-marsa",
    name: "La Marsa Padel",
    area: "La Marsa",
    region: "Tunis",
    distanceKm: 8.9,
    courtCount: 5,
    openMatchCount: 0,
    rating: 4.1,
    placeholderTint: "peach",
  },
  {
    id: "club-ennasr",
    name: "Ennasr Padel Club",
    area: "Ennasr",
    region: "Ariana",
    distanceKm: 9.7,
    courtCount: 4,
    openMatchCount: 0,
    rating: 4.3,
    placeholderTint: "lime",
  },
  {
    id: "club-menzah",
    name: "Padel House Menzah",
    area: "El Menzah",
    region: "Ariana",
    distanceKm: 11,
    courtCount: 3,
    openMatchCount: 0,
    rating: 4.1,
    placeholderTint: "blue",
  },
  {
    id: "club-megrine",
    name: "Megrine Padel",
    area: "Megrine",
    region: "Ben Arous",
    distanceKm: 12.5,
    courtCount: 4,
    openMatchCount: 0,
    rating: 4.0,
    placeholderTint: "green",
  },
  {
    id: "club-hammamet",
    name: "Hammamet Padel Club",
    area: "Yasmine Hammamet",
    region: "Nabeul",
    distanceKm: 64,
    courtCount: 6,
    openMatchCount: 0,
    rating: 4.7,
    placeholderTint: "peach",
  },
  {
    id: "club-sousse",
    name: "Sousse Padel Center",
    area: "Port El Kantaoui",
    region: "Sousse",
    distanceKm: 140,
    courtCount: 5,
    openMatchCount: 0,
    rating: 4.4,
    placeholderTint: "lime",
  },
  {
    id: "club-sfax",
    name: "Sfax Padel Club",
    area: "Sfax Ville",
    region: "Sfax",
    distanceKm: 270,
    courtCount: 4,
    openMatchCount: 0,
    rating: 4.2,
    placeholderTint: "blue",
  },
];

/** Regions in the order the filter shows them */
export const clubRegions = ["Tunis", "Ariana", "Ben Arous", "Nabeul", "Sousse", "Sfax", "Bizerte"];

/** The three closest clubs, for Home */
export const clubsNearby = [...allClubs].sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 3);

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

const clubDetailsById: Record<string, Omit<ClubDetails, keyof Club>> = {
  "club-lac": {
    address: "Les Berges du Lac 2, Tunis",
    photoCount: 6,
    indoorCourts: 4,
    outdoorCourts: 2,
    openUntil: "00:00",
    amenities: ["Parking", "Showers", "Racket rental", "Café"],
    reviewCount: 86,
    ratingBreakdown: [
      { label: "Court surface", value: 4.8 },
      { label: "Glass & walls", value: 4.6 },
      { label: "Lighting", value: 4.9 },
      { label: "Rental gear", value: 3.6 },
      { label: "Changing rooms", value: 4.2 },
    ],
    reviewTags: [
      { label: "Fresh turf", count: 41 },
      { label: "Great lighting", count: 35 },
      { label: "Clean glass", count: 22 },
      { label: "Worn rental rackets", count: 18, negative: true },
      { label: "Flat balls", count: 9, negative: true },
    ],
    courtRatings: [4.7, 4.8, 4.9, 4.6, 3.4, 4.1],
    reviews: [
      {
        id: "review-1",
        author: players.ines,
        courtName: "Court 3",
        postedAt: inDays(-3, 22),
        playedTime: "20:00",
        timesPlayedHere: 6,
        rating: 5,
        scores: { surface: 5, glass: 5, lighting: 5, gear: 2, rooms: 4, staff: 5 },
        topics: ["courts", "gear", "facilities", "staff"],
        text: "Turf feels new and the glass is spotless. Bring your own racket, the rental ones are tired.",
        helpfulCount: 12,
        clubReplied: true,
      },
      {
        id: "review-2",
        author: players.karim,
        courtName: "Court 5",
        postedAt: inDays(-7, 21),
        playedTime: "18:00",
        timesPlayedHere: 14,
        rating: 3,
        topics: ["courts"],
        text: "Court 5 sand is uneven near the net and it gets windy after sunset.",
        helpfulCount: 8,
      },
      {
        id: "review-3",
        author: players.sarra,
        courtName: "Court 2",
        postedAt: inDays(-10, 19),
        playedTime: "19:30",
        timesPlayedHere: 3,
        rating: 4,
        scores: { surface: 4, lighting: 5, rooms: 3 },
        topics: ["courts", "facilities"],
        text: "Great lighting for evening games. Showers were busy, so come a bit early.",
        helpfulCount: 4,
      },
      {
        id: "review-4",
        author: players.omar,
        courtName: "Court 1",
        postedAt: inDays(-16, 21),
        playedTime: "21:00",
        timesPlayedHere: 9,
        rating: 5,
        scores: { staff: 5, gear: 4 },
        topics: ["staff", "gear"],
        text: "Staff found us a free court when ours ran late, and the new balls were ready.",
        helpfulCount: 15,
        clubReplied: true,
      },
    ],
  },
  "club-gammarth": {
    address: "Route de Gammarth, La Marsa",
    photoCount: 4,
    indoorCourts: 2,
    outdoorCourts: 2,
    openUntil: "23:00",
    amenities: ["Parking", "Showers", "Pro shop"],
    reviewCount: 41,
    ratingBreakdown: [
      { label: "Court surface", value: 4.4 },
      { label: "Glass & walls", value: 4.1 },
      { label: "Lighting", value: 4.5 },
      { label: "Rental gear", value: 4.2 },
      { label: "Changing rooms", value: 3.8 },
    ],
    reviewTags: [
      { label: "Friendly staff", count: 19 },
      { label: "Sea breeze", count: 12 },
      { label: "Small changing rooms", count: 7, negative: true },
    ],
  },
  "club-marsa": {
    address: "Avenue Habib Bourguiba, La Marsa",
    photoCount: 3,
    indoorCourts: 0,
    outdoorCourts: 5,
    openUntil: "22:00",
    amenities: ["Parking", "Café"],
    reviewCount: 27,
    ratingBreakdown: [
      { label: "Court surface", value: 4 },
      { label: "Glass & walls", value: 4.2 },
      { label: "Lighting", value: 3.7 },
      { label: "Rental gear", value: 4.3 },
      { label: "Changing rooms", value: 4 },
    ],
    reviewTags: [
      { label: "Easy booking", count: 14 },
      { label: "Dim evening light", count: 6, negative: true },
    ],
  },
};

export function getClubDetails(id: string): ClubDetails | undefined {
  const club = allClubs.find((item) => item.id === id);
  if (!club) return undefined;
  // Clubs without full details yet get sensible defaults
  const details = clubDetailsById[id] ?? {
    address: `${club.area}, ${club.region}`,
    photoCount: 0,
    indoorCourts: 0,
    outdoorCourts: club.courtCount,
    openUntil: "23:00",
    amenities: ["Parking"],
    reviewCount: 0,
    // No reviews yet: the detail screen shows its "Be the first" state
    ratingBreakdown: [],
    reviewTags: [],
  };
  return { ...club, ...details };
}

// Keep the counts on Home in step with the open matches above
for (const club of allClubs) {
  club.openMatchCount = openMatches.filter((match) => match.clubName === club.name).length;
}

/** What players can flag when rating a club; negative ones show in orange once picked */
export const clubReviewTagOptions = [
  { label: "Fresh turf" },
  { label: "True bounce" },
  { label: "Good AC" },
  { label: "Worn rental rackets", negative: true },
  { label: "Flat balls", negative: true },
  { label: "Slippery turf", negative: true },
  { label: "Windy", negative: true },
  { label: "Hard to park", negative: true },
];
