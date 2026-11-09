import type { PlayStyle, Side } from "@/components/setup-game-step";
import type { Player } from "@/types/player";

/** One row in "Where you win": a situation and your win rate in it (0–100) */
export type WinRateStat = { label: string; winRate: number };

/** Who the signed-in player is: details and level, without the match statistics */
export type PlayerProfile = {
  player: Player;
  city: string;
  /** Only known for the signed-in player so far */
  gender?: "male" | "female";
  age?: number;
  /** Preferred side of the court */
  side: Side;
  playStyle: PlayStyle;
  level: number;
  /** The half level the player is working towards, e.g. 5.0 while at 4.5 to 4.9 */
  nextLevel: number;
  /** Progress from the last half level to the next one, 0–1 */
  progressToNext: number;
};

/** The signed-in player's results, from matches with a confirmed score */
export type ProfileStats = {
  /** Matches that were over with all 4 seats taken */
  matchesPlayed: number;
  /** Matches with a confirmed score; the stats below are built from these */
  matchesScored: number;
  /** 0–100 */
  winRate: number;
  /** The current run of wins or losses; undefined without a scored match */
  streak?: { result: "won" | "lost"; count: number };
  /** Level at the end of each of the last 6 months, oldest first */
  levelHistory: { month: string; level: number }[];
  winRates: { title: string; stats: WinRateStat[] }[];
  /** Up to 3 players you've won with most, from 2+ matches together */
  bestPartners: { player: Player; matches: number; wins: number }[];
};
