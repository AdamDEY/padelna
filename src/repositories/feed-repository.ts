import { supabase } from "@/lib/supabase";
import type { ConnectionState, PlayerSuggestion } from "@/types/player";
import type { FeedMatch } from "@/types/post";

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

/**
 * Confirmed matches where you or a friend played, newest first. Pass the last match's
 * `confirmedAt` as `before` to get the next page.
 */
export async function fetchFriendsFeed(before?: Date, limit = 20): Promise<FeedMatch[]> {
  const { data, error } = await supabase.rpc("get_friends_feed", {
    p_before: before?.toISOString() ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data as FeedRow[]).map(toFeedMatch);
}
