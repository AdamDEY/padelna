import type { PlayStyle, Side } from "@/components/setup-game-step";
import type { Player } from "@/types/player";

/** One row in "Where you win": a situation and your win rate in it (0–100) */
export type WinRateStat = { label: string; winRate: number };

export type PlayerProfile = {
  player: Player;
  city: string;
  /** Preferred side of the court */
  side: Side;
  playStyle: PlayStyle;
  level: number;
  /** Progress towards the next half level, 0–1 */
  progressToNext: number;
  /** What it would take to reach the next level: about this many more wins against players of this level or better */
  nextLevelHint: { wins: number; opponentLevel: number };
  matchesPlayed: number;
  reviewCount: number;
  winRate: number;
  /** "W3" = three wins in a row, "L2" = two losses */
  streak: string;
  friendCount: number;
  /** Level at the end of each recent month, oldest first */
  levelHistory: { month: string; level: number }[];
  winRates: { title: string; stats: WinRateStat[] }[];
  bestPartners: { player: Player; matches: number; wins: number }[];
  /** What other players say about you most */
  reputationTags: { label: string; count: number }[];
};
