import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/repositories/auth-repository";
import type { Club } from "@/types/club";
import type { MatchDetails, OpenMatch, UpcomingMatch } from "@/types/match";
import type { Player } from "@/types/player";

// Padel is 2 vs 2
const CAPACITY = 4;
// A match that started less than this long ago still counts as upcoming (it lasts 90 minutes)
const STILL_PLAYING_MS = 90 * 60_000;
// How long to wait before reconnecting after the live connection fails
const RECONNECT_DELAY_MS = 5_000;
// Postgres: exclusion constraint violation, i.e. the host already has a match at that time
const OVERLAP_ERROR_CODE = "23P01";

const MATCH_SELECT = `
  id, host_id, starts_at, duration_minutes, level_min, level_max, kind,
  players_needed, price, note, status,
  court:courts(number, club:clubs(id, name)),
  match_players(seat, player_id)
`;

type MatchRow = {
  id: string;
  host_id: string;
  starts_at: string;
  duration_minutes: number;
  level_min: number;
  level_max: number;
  kind: "friendly" | "competitive";
  players_needed: number;
  price: number | null;
  note: string;
  status: "open" | "cancelled";
  court: { number: number; club: { id: string; name: string } } | null;
  match_players: { seat: number; player_id: string }[];
};

type PlayerCardRow = {
  id: string;
  first_name: string;
  last_name: string;
  city: string;
  level: number | null;
  avatar_url: string | null;
};

/** A club and its courts, for choosing where a match is booked */
export type ClubWithCourts = Pick<Club, "id" | "name" | "area"> & {
  courts: { id: string; number: number }[];
};

export type NewMatch = {
  /** Left out until the host has booked a court */
  courtId?: string;
  startsAt: Date;
  levelMin: number;
  levelMax: number;
  kind: "friendly" | "competitive";
  /** How many spots the host still wants to fill (1–3) */
  playersNeeded: number;
};

/** Every club with its courts. */
export async function fetchClubs(): Promise<ClubWithCourts[]> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, name, area, courts(id, number)")
    .order("name");
  if (error) throw error;
  return (data as ClubWithCourts[]).map((club) => ({
    ...club,
    courts: [...club.courts].sort((a, b) => a.number - b.number),
  }));
}

/** Creates a match hosted by the signed-in player and returns its id. */
export async function createMatch(match: NewMatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You’re signed out. Sign in again.");

  const { data, error } = await supabase
    .from("matches")
    .insert({
      host_id: user.id,
      court_id: match.courtId ?? null,
      starts_at: match.startsAt.toISOString(),
      level_min: match.levelMin,
      level_max: match.levelMax,
      kind: match.kind,
      players_needed: match.playersNeeded,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === OVERLAP_ERROR_CODE) {
      throw new Error("You already host a match at that time. Pick another time.");
    }
    throw error;
  }
  return data.id as string;
}

/** Cancels a match you host. */
export async function cancelMatch(matchId: string) {
  const { error } = await supabase.from("matches").update({ status: "cancelled" }).eq("id", matchId);
  if (error) throw error;
}

/** One match with its line-up, or null when it doesn't exist. */
export async function fetchMatch(matchId: string): Promise<MatchDetails | null> {
  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const cards = await fetchPlayerCards([data as unknown as MatchRow]);
  return toMatchDetails(data as unknown as MatchRow, cards);
}

/**
 * Open matches with a free spot that start in the given window, soonest first.
 * Matches you host or already play in are left out; they are under My matches.
 */
export async function fetchOpenMatches(from: Date, to: Date): Promise<OpenMatch[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You’re signed out. Sign in again.");

  const { data, error } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("status", "open")
    .gt("starts_at", new Date().toISOString())
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at");
  if (error) throw error;

  const rows = (data as unknown as MatchRow[]).filter(
    (row) => !row.match_players.some((seat) => seat.player_id === user.id),
  );
  const cards = await fetchPlayerCards(rows);

  return rows
    .map((row) => toMatchDetails(row, cards))
    .filter((match) => match.players.length < match.capacity)
    .map((match) => ({
      id: match.id,
      startsAt: match.startsAt,
      clubName: match.isCourtBooked ? match.clubName : "Court not booked yet",
      durationMinutes: match.durationMinutes,
      levelMin: match.levelMin ?? 1,
      levelMax: match.levelMax ?? 7,
      players: match.players,
      capacity: match.capacity,
      price: match.price,
      isCourtBooked: match.isCourtBooked,
      courtName: match.courtName,
      host: match.host,
      note: match.note,
      kind: match.kind,
    }));
}

/**
 * Listens for joins, leaves, new matches and cancellations. `onChange` gets the id of the
 * match that changed, or nothing when the connection (re)starts and anything may have changed.
 * Returns a function that stops listening.
 */
export function subscribeToMatchChanges(onChange: (matchId?: string) => void) {
  let channel: RealtimeChannel | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let isStopped = false;

  function connect() {
    channel = supabase
      .channel("match-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, (change) => {
        const row = (change.new as { id?: string }) ?? {};
        const old = (change.old as { id?: string }) ?? {};
        onChange(row.id ?? old.id);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_players" }, (change) => {
        const row = (change.new as { match_id?: string }) ?? {};
        const old = (change.old as { match_id?: string }) ?? {};
        onChange(row.match_id ?? old.match_id);
      })
      .subscribe((status) => {
        if (isStopped) return;
        // Events sent while the phone was offline or asleep are lost, so catch up on every (re)connect
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

/** Takes a seat (1–4) in a match. Throws with a readable message when it can't. */
export async function joinMatch(matchId: string, seat: number) {
  const { error } = await supabase.rpc("join_match", { p_match_id: matchId, p_seat: seat });
  if (error) throw error;
}

/** Leaves a match you joined, which reopens your seat. */
export async function leaveMatch(matchId: string) {
  const { error } = await supabase.rpc("leave_match", { p_match_id: matchId });
  if (error) throw error;
}

/** Open matches you host or play in that haven't finished, soonest first. */
export async function fetchMyUpcomingMatches(): Promise<UpcomingMatch[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You’re signed out. Sign in again.");

  const since = new Date(Date.now() - STILL_PLAYING_MS).toISOString();
  const { data, error } = await supabase
    .from("match_players")
    .select(`matches!inner(${MATCH_SELECT})`)
    .eq("player_id", user.id)
    .eq("matches.status", "open")
    .gte("matches.starts_at", since);
  if (error) throw error;

  const rows = (data as unknown as { matches: MatchRow }[])
    .map((row) => row.matches)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const cards = await fetchPlayerCards(rows);

  return rows.map((row) => {
    const match = toMatchDetails(row, cards);
    return {
      id: match.id,
      startsAt: match.startsAt,
      clubName: match.isCourtBooked ? match.clubName : "Court not booked",
      courtName: match.courtName ?? "",
      players: match.players,
      capacity: match.capacity,
      host: match.host!,
    };
  });
}

/** What other players may see about the players in these matches (no phone or private details). */
async function fetchPlayerCards(rows: MatchRow[]) {
  const ids = [...new Set(rows.flatMap((row) => row.match_players.map((seat) => seat.player_id)))];
  if (ids.length === 0) return new Map<string, Player>();

  const { data, error } = await supabase.rpc("get_player_cards", { player_ids: ids });
  if (error) throw error;
  return new Map(
    (data as PlayerCardRow[]).map((card) => [
      card.id,
      {
        id: card.id,
        firstName: card.first_name,
        lastName: card.last_name,
        level: card.level ?? undefined,
        city: card.city,
        avatarUrl: card.avatar_url ?? undefined,
      } satisfies Player,
    ]),
  );
}

function toMatchDetails(row: MatchRow, cards: Map<string, Player>): MatchDetails {
  // The host takes seat 1 and brings guests (who aren't on the app) for the seats after it;
  // the last players_needed seats are open to other players
  const guestSeats = CAPACITY - row.players_needed;
  const seats: (Player | undefined)[] = Array.from({ length: CAPACITY }, (_, index) => {
    const seat = index + 1;
    const taken = row.match_players.find((item) => item.seat === seat);
    if (taken) return cards.get(taken.player_id);
    if (seat > 1 && seat <= guestSeats) {
      return { id: `guest-${row.id}-${seat}`, firstName: "Guest", lastName: "" };
    }
    return undefined;
  });

  return {
    id: row.id,
    startsAt: new Date(row.starts_at),
    durationMinutes: row.duration_minutes,
    clubName: row.court?.club.name ?? "",
    clubId: row.court?.club.id,
    courtName: row.court ? `Court ${row.court.number}` : undefined,
    isCourtBooked: row.court !== null,
    levelMin: row.level_min,
    levelMax: row.level_max,
    kind: row.kind,
    players: seats.filter((player): player is Player => player !== undefined),
    seats,
    capacity: CAPACITY,
    price: row.price ?? undefined,
    host: cards.get(row.host_id),
    note: row.note || undefined,
  };
}
