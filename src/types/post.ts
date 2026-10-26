import type { Player } from "@/types/player";

/** Two players on one side of the net */
export type Team = [Player, Player];

/** A finished match shared to the Community feed */
export type ResultPost = {
  id: string;
  postedAt: Date;
  playedAt: Date;
  clubName: string;
  courtName: string;
  kind: "friendly" | "competitive";
  levelMin: number;
  levelMax: number;
  /** The posting team comes first */
  teams: [Team, Team];
  /** Games per set, [first team, second team] */
  sets: [number, number][];
  /** All four players confirmed the score */
  confirmed: boolean;
  /** Team photo. Without one the card shows the blue scoreboard instead. */
  photoUri?: string;
  city?: string;
  /** Friends you share with the posting team, for posts from people you don't know */
  mutualFriendCount?: number;
};
