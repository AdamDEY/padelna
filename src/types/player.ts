export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  /** Level on the 1–7 scale, when known */
  level?: number;
  city?: string;
  /** Public URL of the profile photo; initials show when missing */
  avatarUrl?: string;
  /** Friends you have in common with this player */
  mutualFriendCount?: number;
};

/** How the signed-in player relates to another: "sent" = you asked, "received" = they asked */
export type ConnectionState = "none" | "sent" | "received" | "connected";

/** A player on the Players screen: their card, the club they play at and whether you're connected */
export type PlayerSuggestion = Player & {
  connection: ConnectionState;
  /** The club they last played at, when there is one */
  clubName?: string;
};

/** A player to discover: who they are, the side they play and when they joined */
export type DiscoverPlayer = PlayerSuggestion & {
  side: "left" | "right" | "both";
  joinedAt: Date;
};

/** What the player preview and full profile show beyond the card */
export type PlayerDetails = {
  side: "left" | "right" | "both";
  hand: "left" | "right";
  bio: string;
  friendCount: number;
  /** Up to two clubs they've played at most */
  clubNames: string[];
  /** Full matches you've both played in */
  playedTogether: number;
  lastPlayedTogetherAt?: Date;
  /** How you relate to them, for sheets opened from outside the Players lists */
  connection: ConnectionState;
  mutualFriendCount: number;
};

/** Numbers on another player's profile. Mocked until results and reviews are saved per player. */
export type PlayerStats = {
  matches: number;
  won: number;
  lost: number;
  reviews: number;
  /** "Fair play" with how many players said so */
  tags: { label: string; count: number }[];
  asPartners: { won: number; lost: number };
  asOpponents: { won: number; lost: number };
};
