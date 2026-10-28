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
