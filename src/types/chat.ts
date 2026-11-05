import type { Player } from "@/types/player";

/**
 * One line in a match's group chat: a player's message, or a note the app adds
 * when something happens to the match ("Salma joined · the match is full").
 */
export type ChatMessage = {
  id: string;
  kind: "text" | "joined" | "joined_full" | "left" | "court_booked" | "court_changed" | "court_unbooked" | "cancelled";
  /** Empty for notes */
  body: string;
  /** Who wrote it, or who the note is about; missing once their account is deleted */
  sender?: Player;
  createdAt: Date;
};
