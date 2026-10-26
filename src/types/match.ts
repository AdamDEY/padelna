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
};
