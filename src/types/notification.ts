import type { Player } from "@/types/player";

// Same kinds as the database's `notifications.kind`
export type NotificationKind =
  | "chat_message"
  | "player_joined"
  | "match_full"
  | "player_left"
  | "court_booked"
  | "court_changed"
  | "court_unbooked"
  | "match_cancelled"
  | "score_to_confirm"
  | "rate_players"
  | "connection_request"
  | "connection_accepted";

/** Which filter tab a notification belongs to */
export type NotificationGroup = "matches" | "friends";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  createdAt: Date;
  isRead: boolean;
  /** The person it's about (sender, joiner or requester); missing if their account is gone */
  player?: Player;
  /** App route the notification opens, e.g. "/match/…/chat" */
  url: string;
  matchId?: string;
  startsAt?: Date;
  /** Missing while the match has no court booked */
  clubName?: string;
  /** Messages waiting, for chat_message */
  count?: number;
};
