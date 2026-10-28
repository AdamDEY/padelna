import type { Player } from "@/types/player";

/** A match you have joined or are hosting */
export type NextMatch = {
  id: string;
  startsAt: Date;
  clubName: string;
  courtName: string;
  players: Player[];
};

/** A match looking for players */
export type OpenMatch = {
  id: string;
  startsAt: Date;
  clubName: string;
  durationMinutes: number;
  levelMin: number;
  levelMax: number;
  players: Player[];
  /** Padel is played 2 vs 2 */
  capacity: number;
  /** Price per player, in TND */
  price: number;
  isMixed?: boolean;
  /** The host has booked the court */
  isCourtBooked?: boolean;
  courtName?: string;
  host?: Player;
  /** The host's message to players */
  note?: string;
  kind?: "friendly" | "competitive";
  /** Who the match is for */
  audience?: "Men" | "Women" | "Mixed";
};

/** A match you are hosting or have joined */
export type UpcomingMatch = NextMatch & {
  capacity: number;
  host: Player;
};

/** A finished match from your history. Sets are [your games, their games]. */
export type PastMatch = {
  id: string;
  playedAt: Date;
  clubName: string;
  courtName?: string;
  won: boolean;
  sets: [number, number][];
};

/** A match you played through the app that you can still share to Community */
export type ShareableMatch = {
  id: string;
  playedAt: Date;
  clubName: string;
  /** The other players, shown as a small avatar stack */
  players: Player[];
  /** What's missing before it makes a full post */
  missing: "score" | "photo";
};

/** A finished match still waiting for its result and player ratings */
export type PendingReview = {
  matchId: string;
  playedAt: Date;
  clubName: string;
  /** Last moment the result can be added */
  closesAt: Date;
};

/** Everything the Match detail screen shows, for open matches and your own */
export type MatchDetails = {
  id: string;
  startsAt: Date;
  durationMinutes: number;
  clubName: string;
  courtName?: string;
  isCourtBooked: boolean;
  levelMin?: number;
  levelMax?: number;
  kind: "friendly" | "competitive";
  audience?: "Men" | "Women" | "Mixed";
  /** In seat order: the first two play together, the last two together */
  players: Player[];
  capacity: number;
  price?: number;
  host?: Player;
  note?: string;
  /** Set for matches that come from the database, to link to the club */
  clubId?: string;
};
