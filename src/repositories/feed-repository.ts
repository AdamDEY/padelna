import { supabase } from "@/lib/supabase";
import type { ConnectionState, PlayerSuggestion } from "@/types/player";
import type { ClubsWeek, FeedMatch, RisingPlayer } from "@/types/post";

// Padel is 2 vs 2
const CAPACITY = 4;

type FeedPlayerRow = {
  seat: number;
  id: string;
  first_name: string;
  last_name: string;
  level: number | null;
  avatar_url: string | null;
  connection: ConnectionState;
};

type FeedRow = {
  match_id: string;
  played_at: string;
  confirmed_at: string;
  club_name: string | null;
  court_number: number | null;
  kind: "friendly" | "competitive";
  level_min: number;
  level_max: number;
  team1_games: number[];
  team2_games: number[];
  photo_path: string | null;
  players: FeedPlayerRow[] | null;
};

function toFeedMatch(row: FeedRow): FeedMatch {
  const players = row.players ?? [];
  // Seats nobody on the app took belong to the host's guests
  const seats = Array.from({ length: CAPACITY }, (_, index): PlayerSuggestion => {
    const taken = players.find((player) => player.seat === index + 1);
    if (!taken) {
      return { id: `guest-${row.match_id}-${index + 1}`, firstName: "Guest", lastName: "", connection: "none" };
    }
    return {
      id: taken.id,
      firstName: taken.first_name,
      lastName: taken.last_name,
      level: taken.level ?? undefined,
      avatarUrl: taken.avatar_url ?? undefined,
      connection: taken.connection,
    };
  });

  return {
    id: row.match_id,
    playedAt: new Date(row.played_at),
    confirmedAt: new Date(row.confirmed_at),
    clubName: row.club_name ?? "Court not booked",
    courtName: row.court_number ? `Court ${row.court_number}` : undefined,
    kind: row.kind,
    levelMin: row.level_min,
    levelMax: row.level_max,
    seats,
    sets: row.team1_games.map((games, index): [number, number] => [games, row.team2_games[index]]),
    photoPath: row.photo_path ?? undefined,
  };
}

async function fetchFeed(fn: string, args: Record<string, unknown>, before?: Date, limit = 20) {
  const { data, error } = await supabase.rpc(fn, {
    ...args,
    p_before: before?.toISOString() ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as FeedRow[]).map(toFeedMatch);
}

/**
 * Confirmed matches where you or a friend played, newest first. Pass the last match's
 * `confirmedAt` as `before` to get the next page.
 */
export function fetchFriendsFeed(before?: Date, limit = 20): Promise<FeedMatch[]> {
  return fetchFeed("get_friends_feed", {}, before, limit);
}

/** Confirmed matches at the clubs where you've played, or at one of them; paged like the Friends feed. */
export function fetchClubsFeed(clubId?: string, before?: Date, limit = 20): Promise<FeedMatch[]> {
  return fetchFeed("get_clubs_feed", { p_club_id: clubId ?? null }, before, limit);
}

/** Confirmed matches anywhere in Tunisia, or in one city; paged like the Friends feed. */
export function fetchTunisiaFeed(city?: string, before?: Date, limit = 20): Promise<FeedMatch[]> {
  return fetchFeed("get_tunisia_feed", { p_city: city ?? null }, before, limit);
}

/** Cities with confirmed results, busiest first. */
export async function fetchCommunityCities(): Promise<string[]> {
  const { data, error } = await supabase.rpc("get_community_cities");
  if (error) throw error;
  return (data as { city: string }[]).map((row) => row.city);
}

/** This week at your clubs: matches played and open matches for your level. */
export async function fetchClubsWeek(): Promise<ClubsWeek> {
  const { data, error } = await supabase.rpc("get_clubs_week");
  if (error) throw error;
  const row = (data as { matches_played: number; open_for_your_level: number }[])[0];
  return { matchesPlayed: row?.matches_played ?? 0, openForYourLevel: row?.open_for_your_level ?? 0 };
}

type RisingRow = {
  id: string;
  first_name: string;
  last_name: string;
  city: string;
  level: number | null;
  avatar_url: string | null;
  connection: ConnectionState;
  mutual_count: number;
  level_change: number;
};

/** Players whose level rose most from matches in the last 30 days. */
export async function fetchRisingPlayers(limit = 10): Promise<RisingPlayer[]> {
  const { data, error } = await supabase.rpc("get_rising_players", { p_limit: limit });
  if (error) throw error;
  return (data as RisingRow[]).map((row) => ({
    player: {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      city: row.city,
      level: row.level ?? undefined,
      avatarUrl: row.avatar_url ?? undefined,
      mutualFriendCount: row.mutual_count,
      connection: row.connection,
    },
    levelChange: Number(row.level_change),
  }));
}
