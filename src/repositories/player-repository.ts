import type { RealtimeChannel } from "@supabase/supabase-js";
import { t } from "i18next";

import type { PlayerTag, PlayerTagCount } from "@/data/player-tags";
import { supabase } from "@/lib/supabase";
import type { ConnectionState, DiscoverPlayer, Friend, PlayerDetails, PlayerSuggestion } from "@/types/player";

// How long to wait before reconnecting after the live connection fails
const RECONNECT_DELAY_MS = 5_000;

// What every player list function returns: the public card (no phone or private details)
// plus how you relate to the player
type SuggestionRow = {
  id: string;
  first_name: string;
  last_name: string;
  city: string;
  level: number | null;
  avatar_url: string | null;
  connection: ConnectionState;
  club_name: string | null;
  mutual_count: number;
};

type DetailsRow = {
  side: PlayerDetails["side"];
  hand: PlayerDetails["hand"];
  bio: string;
  friend_count: number;
  club_names: string[];
  played_together: number;
  last_played_together_at: string | null;
  connection: ConnectionState;
  mutual_count: number;
};

/** A club where you've played at least one full match */
export type MyClub = { id: string; name: string; matchCount: number };

function toSuggestion(row: SuggestionRow): PlayerSuggestion {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    city: row.city,
    level: row.level ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    mutualFriendCount: row.mutual_count,
    connection: row.connection,
    clubName: row.club_name ?? undefined,
  };
}

async function fetchList(fn: string, args?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return (data as SuggestionRow[]).map(toSuggestion);
}

/** Clubs you've played a full match at, most played first. */
export async function fetchMyClubs(): Promise<MyClub[]> {
  const { data, error } = await supabase.rpc("get_my_clubs");
  if (error) throw error;
  return (data as { club_id: string; club_name: string; match_count: number }[]).map((row) => ({
    id: row.club_id,
    name: row.club_name,
    matchCount: row.match_count,
  }));
}

/** People from your finished matches you aren't connected to yet, most recent first. */
export function fetchPlayedWith() {
  return fetchList("get_played_with");
}

/** Players at your clubs within half a level of you, friends in common first. */
export function fetchPlayersAtMyClubs() {
  return fetchList("get_players_at_my_clubs");
}

/** Players within a level of you to connect with, your city and closest level first. */
export async function fetchDiscoverPlayers(): Promise<DiscoverPlayer[]> {
  const { data, error } = await supabase.rpc("get_discover_players");
  if (error) throw error;
  return (data as (SuggestionRow & { side: DiscoverPlayer["side"]; joined_at: string })[]).map((row) => ({
    ...toSuggestion(row),
    side: row.side,
    joinedAt: new Date(row.joined_at),
  }));
}

/** Everyone you're connected to, the players you've played most with first. */
export async function fetchMyFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc("get_my_friends");
  if (error) throw error;
  type Row = Omit<SuggestionRow, "connection" | "club_name" | "mutual_count"> & {
    matches_together: number;
    last_played_at: string | null;
    connected_at: string;
  };
  return (data as Row[]).map((row) => ({
    ...toSuggestion({ ...row, connection: "connected", club_name: null, mutual_count: 0 }),
    matchesTogether: row.matches_together,
    lastPlayedAt: row.last_played_at ? new Date(row.last_played_at) : undefined,
    connectedAt: new Date(row.connected_at),
  }));
}

/** Connection requests waiting for you, newest first. */
export function fetchConnectionRequests() {
  return fetchList("get_connection_requests");
}

/** Players whose name, or a club they've played at, matches `query` (2+ characters). */
export function searchPlayers(query: string) {
  return fetchList("search_players", { p_query: query });
}

/** How a player plays, their bio, friends, clubs and your history together. */
export async function fetchPlayerDetails(playerId: string): Promise<PlayerDetails> {
  const { data, error } = await supabase.rpc("get_player_profile", { p_player_id: playerId });
  if (error) throw error;
  const row = (data as DetailsRow[])[0];
  if (!row) throw new Error(t("errors.playerUnavailable"));
  return {
    side: row.side,
    hand: row.hand,
    bio: row.bio,
    friendCount: row.friend_count,
    clubNames: row.club_names,
    playedTogether: row.played_together,
    lastPlayedTogetherAt: row.last_played_together_at ? new Date(row.last_played_together_at) : undefined,
    connection: row.connection,
    mutualFriendCount: row.mutual_count,
  };
}

/** What players say about someone: each tag with how many players gave it, most first. */
export async function fetchPlayerTags(playerId: string): Promise<PlayerTagCount[]> {
  const { data, error } = await supabase.rpc("get_player_tags", { p_player_id: playerId });
  if (error) throw error;
  return (data as { tag: PlayerTag; count: number }[]).map((row) => ({ tag: row.tag, count: Number(row.count) }));
}

/** Sends a connection request, or accepts theirs if they already asked you. */
export async function requestConnection(playerId: string) {
  const { error } = await supabase.rpc("request_connection", { p_player_id: playerId });
  if (error) throw error;
}

/** Accepts or declines a request someone sent you. */
export async function respondToConnection(playerId: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_to_connection", {
    p_player_id: playerId,
    p_accept: accept,
  });
  if (error) throw error;
}

/** Cancels a request you sent, or removes a player you're connected to. */
export async function removeConnection(playerId: string) {
  const { error } = await supabase.rpc("remove_connection", { p_player_id: playerId });
  if (error) throw error;
}

/**
 * Calls `onChange` whenever one of your connections or requests changes (row-level
 * security only sends your own), and when the connection (re)starts. Returns a stop function.
 */
export function subscribeToConnectionChanges(onChange: () => void) {
  let channel: RealtimeChannel | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;

  function connect() {
    channel = supabase
      .channel("connection-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, () => onChange())
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
