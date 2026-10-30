import type { Player, PlayerSuggestion } from "@/types/player";

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
  /** Team photo. Without one the card shows the blue scoreboard instead; "" while it loads. */
  photoUri?: string;
  city?: string;
  /** Friends you share with the posting team, for posts from people you don't know */
  mutualFriendCount?: number;
};

/** A confirmed match in the Friends feed, straight from the database */
export type FeedMatch = {
  id: string;
  playedAt: Date;
  /** When the other team confirmed the score; the feed is ordered by it */
  confirmedAt: Date;
  clubName: string;
  courtName?: string;
  kind: "friendly" | "competitive";
  levelMin: number;
  levelMax: number;
  /** Seats 1–4; the host's guests aren't on the app and come as "Guest" with connection "none" */
  seats: PlayerSuggestion[];
  /** Games per set: [team 1 (seats 1–2), team 2 (seats 3–4)] */
  sets: [number, number][];
  /** Storage path of the team photo, when the host added one */
  photoPath?: string;
};
