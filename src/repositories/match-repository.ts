import type { RealtimeChannel } from "@supabase/supabase-js";
import { t } from "i18next";

import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/repositories/auth-repository";
import type { Club } from "@/types/club";
import { teamOf, winningTeam, type SetScore } from "@/lib/padel-score";
import type {
  MatchDetails,
  MatchScore,
  OpenMatch,
  PastMatch,
  PendingReview,
  UpcomingMatch,
} from "@/types/match";
import type { Player } from "@/types/player";

// Padel is 2 vs 2
const CAPACITY = 4;
// A match that started less than this long ago still counts as upcoming (it lasts 90 minutes)
const STILL_PLAYING_MS = 90 * 60_000;
// How long after a match the host can still add its score (same as the database)
const SCORE_SAVE_WINDOW_MS = 7 * 86_400_000;
// How many finished matches My matches lists
const PAST_MATCH_LIMIT = 30;
// Match photos are private; their links work this long before the app asks for a new one
const PHOTO_LINK_SECONDS = 60 * 60;
const PHOTO_BUCKET = "match-photos";
// How long to wait before reconnecting after the live connection fails
const RECONNECT_DELAY_MS = 5_000;
// Postgres: exclusion constraint violation, i.e. the host already has a match at that time
const OVERLAP_ERROR_CODE = "23P01";

const MATCH_SELECT = `
  id, host_id, starts_at, duration_minutes, level_min, level_max, kind,
  players_needed, price, note, status,
  court:courts(number, club:clubs(id, name)),
  match_players(seat, player_id),
  score:match_scores(team1_games, team2_games, status, submitted_by, submitted_team, expires_at, photo_path)
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
  // One-to-one, so PostgREST embeds an object (or null), not a list
  score: ScoreRow | null;
};

type ScoreRow = {
  team1_games: number[];
  team2_games: number[];
  status: "pending" | "confirmed";
  submitted_by: string;
  submitted_team: 1 | 2;
  expires_at: string;
  photo_path: string | null;
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
      clubName: match.isCourtBooked ? match.clubName : t("match.courtNotBookedYet"),
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
      .on("postgres_changes", { event: "*", schema: "public", table: "match_scores" }, (change) => {
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

/**
 * Sends a finished match's score: the host's first version, the other team's correction,
 * or an edit by whoever sent it. Throws with a readable message when it can't.
 */
export async function submitScore(matchId: string, sets: SetScore[]) {
  const { error } = await supabase.rpc("submit_score", {
    p_match_id: matchId,
    p_team1_games: sets.map((set) => set[0]),
    p_team2_games: sets.map((set) => set[1]),
  });
  if (error) throw error;
}

/**
 * Uploads the host's team photo into the match's folder and attaches it to the score.
 * Each upload gets its own file name, so a replaced photo never shows from the cache.
 */
export async function uploadMatchPhoto(matchId: string, uri: string) {
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const extension = contentType.split("/")[1] ?? "jpg";
  const path = `${matchId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, body, { contentType });
  if (uploadError) throw uploadError;

  const { error } = await supabase.rpc("set_match_photo", { p_match_id: matchId, p_path: path });
  if (error) throw error;
}

/** A short-lived link to a match photo; only the match's players get one. */
export async function fetchMatchPhotoUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, PHOTO_LINK_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

/** Confirms the score the other team sent. */
export async function confirmScore(matchId: string) {
  const { error } = await supabase.rpc("confirm_score", { p_match_id: matchId });
  if (error) throw error;
}

/**
 * Finished matches where it's your turn: you host one with no score yet, or the other
 * team sent a score you can confirm. Most recent first.
 */
export async function fetchMyPendingScores(): Promise<PendingReview[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You’re signed out. Sign in again.");

  const now = Date.now();
  const { data, error } = await supabase
    .from("match_players")
    .select(`matches!inner(${MATCH_SELECT})`)
    .eq("player_id", user.id)
    .eq("matches.status", "open")
    .gte("matches.starts_at", new Date(now - STILL_PLAYING_MS - SCORE_SAVE_WINDOW_MS).toISOString())
    .lte("matches.starts_at", new Date(now - STILL_PLAYING_MS).toISOString());
  if (error) throw error;

  const rows = (data as unknown as { matches: MatchRow }[])
    .map((row) => row.matches)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const cards = await fetchPlayerCards(rows);

  return rows.flatMap((row): PendingReview[] => {
    const match = toMatchDetails(row, cards);
    const endsAt = new Date(match.startsAt.getTime() + match.durationMinutes * 60_000);
    const base = { matchId: match.id, playedAt: match.startsAt, clubName: match.clubName || t("match.yourMatch") };
    const score = match.score;

    if (!match.isFull) return [];
    if (!score) {
      return row.host_id === user.id
        ? [{ ...base, action: "add", closesAt: new Date(endsAt.getTime() + SCORE_SAVE_WINDOW_MS) }]
        : [];
    }
    if (score.status === "pending" && teamOf(match, user.id) !== score.submittedTeam) {
      return [{ ...base, action: "confirm", closesAt: score.expiresAt }];
    }
    return [];
  });
}

/** Matches you played that are over and had all 4 players, most recent first. */
export async function fetchMyPastMatches(): Promise<PastMatch[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You’re signed out. Sign in again.");

  const { data, error } = await supabase
    .from("match_players")
    .select(`matches!inner(${MATCH_SELECT})`)
    .eq("player_id", user.id)
    .eq("matches.status", "open")
    .lte("matches.starts_at", new Date(Date.now() - STILL_PLAYING_MS).toISOString());
  if (error) throw error;

  const rows = (data as unknown as { matches: MatchRow }[])
    .map((row) => row.matches)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .slice(0, PAST_MATCH_LIMIT);
  const cards = await fetchPlayerCards(rows);

  return rows.flatMap((row): PastMatch[] => {
    const match = toMatchDetails(row, cards);
    // A match that never had 4 players wasn't played
    if (!match.isFull) return [];

    const { score } = match;
    const myTeam = teamOf(match, user.id);
    const winner = score ? winningTeam(score.sets) : undefined;
    const result: PastMatch["result"] =
      !score || score.status === "expired"
        ? "none"
        : score.status === "pending" || winner === undefined || myTeam === undefined
          ? "unconfirmed"
          : winner === myTeam
            ? "won"
            : "lost";
    return [
      {
        id: match.id,
        playedAt: match.startsAt,
        clubName: match.clubName || t("match.courtNotBooked"),
        courtName: match.courtName,
        result,
        // Shown from your side: your games first
        sets:
          score && score.status !== "expired"
            ? score.sets.map(([a, b]): [number, number] => (myTeam === 2 ? [b, a] : [a, b]))
            : [],
      },
    ];
  });
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
      clubName: match.isCourtBooked ? match.clubName : t("match.courtNotBooked"),
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
      return { id: `guest-${row.id}-${seat}`, firstName: t("match.guest"), lastName: "" };
    }
    return undefined;
  });

  return {
    id: row.id,
    startsAt: new Date(row.starts_at),
    durationMinutes: row.duration_minutes,
    clubName: row.court?.club.name ?? "",
    clubId: row.court?.club.id,
    courtName: row.court ? t("match.courtNumber", { number: row.court.number }) : undefined,
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
    // The host and their guests, plus one row per player who joined
    isFull: row.match_players.length === row.players_needed + 1,
    score: row.score ? toMatchScore(row.score) : undefined,
  };
}

function toMatchScore(row: ScoreRow): MatchScore {
  const expiresAt = new Date(row.expires_at);
  const isExpired = row.status === "pending" && expiresAt.getTime() < Date.now();
  return {
    sets: row.team1_games.map((games, index): SetScore => [games, row.team2_games[index]]),
    status: isExpired ? "expired" : row.status,
    submittedBy: row.submitted_by,
    submittedTeam: row.submitted_team,
    expiresAt,
    photoPath: row.photo_path ?? undefined,
  };
}
