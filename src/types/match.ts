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
  won: boolean;
  sets: [number, number][];
};

/** A finished match still waiting for its result and player ratings */
export type PendingReview = {
  matchId: string;
  playedAt: Date;
  clubName: string;
  /** Last moment the result can be added */
  closesAt: Date;
};
