import type { RealtimeChannel } from "@supabase/supabase-js";
import { t } from "i18next";

import { supabase } from "@/lib/supabase";
import type { ChatMessage } from "@/types/chat";
import type { Player } from "@/types/player";

// Messages per page; older ones load as you scroll up
export const CHAT_PAGE_SIZE = 40;
// How long to wait before reconnecting after the live connection fails
const RECONNECT_DELAY_MS = 5_000;

type MessageRow = {
  id: string;
  sender_id: string | null;
  kind: ChatMessage["kind"];
  body: string;
  created_at: string;
};

type PlayerCardRow = {
  id: string;
  first_name: string;
  last_name: string;
  level: number | null;
  avatar_url: string | null;
};

/** A page of a match's chat, newest first, written before `before` when given. */
export async function fetchMatchMessages(matchId: string, before?: string): Promise<ChatMessage[]> {
  let query = supabase
    .from("match_messages")
    .select("id, sender_id, kind, body, created_at")
    .eq("match_id", matchId)
    .order("created_at", { ascending: false })
    .limit(CHAT_PAGE_SIZE);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;
  if (error) throw error;
  const rows = data as MessageRow[];

  // Senders may have left the match since, so their cards come from the players' public cards
  const ids = [...new Set(rows.flatMap((row) => (row.sender_id ? [row.sender_id] : [])))];
  const senders = new Map<string, Player>();
  if (ids.length > 0) {
    const { data: cards, error: cardsError } = await supabase.rpc("get_player_cards", { player_ids: ids });
    if (cardsError) throw cardsError;
    for (const card of cards as PlayerCardRow[]) {
      senders.set(card.id, {
        id: card.id,
        firstName: card.first_name,
        lastName: card.last_name,
        level: card.level ?? undefined,
        avatarUrl: card.avatar_url ?? undefined,
      });
    }
  }

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    body: row.body,
    sender: row.sender_id ? senders.get(row.sender_id) : undefined,
    createdAt: new Date(row.created_at),
  }));
}

/** Sends a message to the match's group chat as the signed-in player. */
export async function sendMatchMessage(matchId: string, body: string) {
  const { error } = await supabase.from("match_messages").insert({ match_id: matchId, body: body.trim() });
  if (error) {
    // Row-level security: you left the match, or it was cancelled
    if (error.code === "42501") throw new Error(t("errors.chatPlayersOnly"));
    throw error;
  }
}

/** Remembers that you've seen the chat up to now, which clears its unread dot. */
export async function markMatchChatRead(matchId: string) {
  const { error } = await supabase.rpc("mark_match_chat_read", { p_match_id: matchId });
  if (error) throw error;
}

/** Messages from other players (and notes) since you last opened the chat. */
export async function fetchMatchChatUnreadCount(matchId: string) {
  const { data, error } = await supabase.rpc("match_chat_unread_count", { p_match_id: matchId });
  if (error) throw error;
  return data as number;
}

let nextInstance = 0;

/**
 * Calls `onChange` for every new message in a match's chat, and when the connection
 * (re)starts, since messages sent meanwhile are lost. Returns a function that stops listening.
 * `listener` keeps two screens on the same match (the match and its chat) on separate channels.
 */
export function subscribeToMatchMessages(matchId: string, listener: string, onChange: () => void) {
  // The same match can be on screen twice (opened again from a notification), and Supabase
  // hands back the existing channel for a repeated name, which can't take new callbacks
  const instance = nextInstance++;
  let channel: RealtimeChannel | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;

  function connect() {
    channel = supabase
      .channel(`match-chat-${matchId}-${listener}-${instance}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_messages", filter: `match_id=eq.${matchId}` },
        () => onChange(),
      )
      .subscribe((status) => {
        if (isStopped) return;
        if (status === "SUBSCRIBED") onChange();
        // A failed channel doesn't recover by itself: drop it and connect again shortly
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          supabase.removeChannel(channel!);
          retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      });
  }

  connect();

  return () => {
    isStopped = true;
    clearTimeout(retryTimer);
    if (channel) supabase.removeChannel(channel);
  };
}
