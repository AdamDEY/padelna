import type { SetScore } from "@/lib/padel-score";
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
  /** Set once the host has booked a court */
  clubId?: string;
  clubName: string;
  durationMinutes: number;
  levelMin: number;
  levelMax: number;
  players: Player[];
  /** Padel is played 2 vs 2 */
  capacity: number;
  /** Price per player, in TND; left out until the club sets it */
  price?: number;
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
  /** "unconfirmed": a score was sent but the other team hasn't agreed; "none": no score counts */
  result: "won" | "lost" | "unconfirmed" | "none";
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

/**
 * A finished match waiting for you: the host adds its score, the other team confirms it,
 * and once there is a score everyone rates the other players.
 */
export type PendingReview = {
  matchId: string;
  playedAt: Date;
  clubName: string;
  action: "add" | "confirm" | "rate";
  /** Last moment to add or confirm the score, or to rate the players */
  closesAt: Date;
};

/**
 * A match's score. One player from each team has to agree: the host's team sends it
 * and the other team confirms (or corrects it, and then the host's team confirms).
 */
export type MatchScore = {
  /** Games per set: [team 1 (seats 1–2), team 2 (seats 3–4)] */
  sets: SetScore[];
  /** "expired": nobody confirmed it in time, so it never counts */
  status: "pending" | "confirmed" | "expired";
  submittedBy: string;
  submittedTeam: 1 | 2;
  /** When a pending score expires */
  expiresAt: Date;
  /** When the other team confirmed it; rating closes a few days later */
  confirmedAt?: Date;
  /** Storage path of the team photo the host added; shown through a signed URL */
  photoPath?: string;
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
  /**
   * One entry per seat (seats 1–2 are one team, 3–4 the other): a player, a guest
   * of the host, or undefined for an open seat. `players` leaves the open ones out.
   */
  seats?: (Player | undefined)[];
  /** Database matches only: whether every seat was taken, so a score can be added */
  isFull?: boolean;
  /** Once the host has sent one */
  score?: MatchScore;
  /** Database matches only: who rated this match. Ratings are anonymous, so players only see themselves here. */
  ratedBy?: string[];
};
