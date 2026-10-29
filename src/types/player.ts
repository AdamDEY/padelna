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
