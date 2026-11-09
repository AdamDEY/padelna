import type { RealtimeChannel } from "@supabase/supabase-js";
import { t } from "i18next";

import { supabase } from "@/lib/supabase";
import { getCurrentUser } from "@/repositories/auth-repository";
import { teamOf, winningTeam, type SetScore } from "@/lib/padel-score";
import { guestId, isRatingOpen, playersToRate, ratingClosesAt, type PlayerRating } from "@/lib/player-rating";
import type {
  MatchAudience,
  MatchDetails,
  MatchScore,
  OpenMatch,
  PastMatch,
  PendingReview,
  ShareableMatch,
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
// Matches older than this are too old to post to Community
const SHAREABLE_DAYS = 30;
// Match photos are private; their links work this long before the app asks for a new one
const PHOTO_LINK_SECONDS = 60 * 60;
const PHOTO_BUCKET = "match-photos";
// How long to wait before reconnecting after the live connection fails
const RECONNECT_DELAY_MS = 5_000;
// Postgres: exclusion constraint violation, i.e. the host already has a match at that time
const OVERLAP_ERROR_CODE = "23P01";

const MATCH_SELECT = `
  id, host_id, starts_at, duration_minutes, level_min, level_max, kind, audience,
  players_needed, price, note, status, origin,
  court:courts(id, number, club:clubs(id, name)),
  match_players(seat, player_id),
  score:match_scores(team1_games, team2_games, status, submitted_by, submitted_team, expires_at, confirmed_at, photo_path),
  ratings:player_ratings(rater_id)
`;

type MatchRow = {
  id: string;
  host_id: string;
  starts_at: string;
  duration_minutes: number;
  level_min: number;
  level_max: number;
  kind: "friendly" | "competitive";
  audience: MatchAudience;
  players_needed: number;
  price: number | null;
  note: string;
  status: "open" | "cancelled";
  origin: "app" | "logged";
  court: { id: string; number: number; club: { id: string; name: string } } | null;
  match_players: { seat: number; player_id: string }[];
  // One-to-one, so PostgREST embeds an object (or null), not a list
  score: ScoreRow | null;
  // Only the ratings you gave are readable, one row per player you rated
  ratings: { rater_id: string }[];
};

type ScoreRow = {
  team1_games: number[];
  team2_games: number[];
  status: "pending" | "confirmed";
  submitted_by: string;
  submitted_team: 1 | 2;
  expires_at: string;
  confirmed_at: string | null;
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

export type NewMatch = {
  /** Left out until the host has booked a court */
  courtId?: string;
  startsAt: Date;
  levelMin: number;
  levelMax: number;
  kind: "friendly" | "competitive";
  audience: MatchAudience;
  /** How many spots the host still wants to fill (1–3) */
  playersNeeded: number;
};

/** Creates a match hosted by the signed-in player and returns its id. */
export async function createMatch(match: NewMatch) {
  const user = await getCurrentUser();
  if (!user) throw new Error(t("errors.signedOut"));

  const { data, error } = await supabase
    .from("matches")
    .insert({
      host_id: user.id,
      court_id: match.courtId ?? null,
      starts_at: match.startsAt.toISOString(),
      level_min: match.levelMin,
      level_max: match.levelMax,
      kind: match.kind,
      audience: match.audience,
      players_needed: match.playersNeeded,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === OVERLAP_ERROR_CODE) {
      throw new Error(t("errors.hostOverlap"));
    }
    throw error;
  }
  return data.id as string;
}

export type LoggedMatch = {
  courtId: string;
  startsAt: Date;
  kind: "friendly" | "competitive";
  /** Plays on your team (seat 2) */
  partnerId: string;
  /** The other team (seats 3 and 4) */
  opponentIds: [string, string];
  /** [your team, their team] per set */
  sets: SetScore[];
};

/**
 * Logs a match played outside the app, with you as its host, and returns its id. The score
 * waits for a player from the other team to confirm it, like any other.
 */
export async function logMatch(match: LoggedMatch) {
  const { data, error } = await supabase.rpc("log_match", {
    p_court_id: match.courtId,
    p_starts_at: match.startsAt.toISOString(),
    p_kind: match.kind,
    p_partner_id: match.partnerId,
    p_opponent_ids: match.opponentIds,
    p_team1_games: match.sets.map((set) => set[0]),
    p_team2_games: match.sets.map((set) => set[1]),
  });
  if (error) {
    if (error.code === OVERLAP_ERROR_CODE) {
      throw new Error(t("errors.hostOverlap"));
    }
    throw error;
  }
  return data as string;
}

export type MatchChanges = {
  startsAt: Date;
  levelMin: number;
  levelMax: number;
  kind: "friendly" | "competitive";
  audience: MatchAudience;
};

/**
 * Changes the time, level range and type of a match you host. The database only allows it
 * before the start and while nobody else has joined.
 */
export async function updateMatch(matchId: string, changes: MatchChanges) {
  const { error } = await supabase
    .from("matches")
    .update({
      starts_at: changes.startsAt.toISOString(),
      level_min: changes.levelMin,
      level_max: changes.levelMax,
      kind: changes.kind,
      audience: changes.audience,
    })
    .eq("id", matchId)
    // An update the policies refuse changes no row instead of failing; .single() turns that into an error
    .select("id")
    .single();
  if (error) {
    if (error.code === OVERLAP_ERROR_CODE) {
      throw new Error(t("errors.hostOverlap"));
    }
    throw error;
  }
}

/** Books, changes or clears (null) the court of a match you host. The players get a chat note. */
export async function setMatchCourt(matchId: string, courtId: string | null) {
  const { error } = await supabase
    .from("matches")
    .update({ court_id: courtId })
    .eq("id", matchId)
    .select("id")
    .single();
  if (error) throw error;
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
  if (!user) throw new Error(t("errors.signedOut"));

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
      clubId: match.clubId,
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
      audience: match.audience,
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

/**
 * Rates the other players in a finished match, all at once; ratings are anonymous and final.
 * Throws with a readable message when it can't.
 */
export async function submitRatings(matchId: string, ratings: PlayerRating[]) {
  const { error } = await supabase.rpc("submit_ratings", {
    p_match_id: matchId,
    p_player_ids: ratings.map((item) => item.playerId),
    p_ratings: ratings.map((item) => item.rating),
    // { playerId: [tags] }; players with no tags are left out
    p_tags: Object.fromEntries(
      ratings.filter((item) => item.tags.length > 0).map((item) => [item.playerId, item.tags]),
    ),
  });
  if (error) throw error;
}

/** Confirms the score the other team sent. */
export async function confirmScore(matchId: string) {
  const { error } = await supabase.rpc("confirm_score", { p_match_id: matchId });
  if (error) throw error;
}

/**
 * Finished matches where it's your turn: you host one with no score yet, the other
 * team sent a score you can confirm, or there's a score and you haven't rated the
 * other players yet. Most recent first.
 */
export async function fetchMyPendingScores(): Promise<PendingReview[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error(t("errors.signedOut"));

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
    if (isRatingOpen(match, user.id, new Date(now)) && playersToRate(match, user.id).length > 0) {
      return [{ ...base, action: "rate", closesAt: ratingClosesAt(score) }];
    }
    return [];
  });
}

/**
 * Recent matches you hosted that could still make a Community post: the score was never
 * added (while there is still time to add it), or it was added without a team photo.
 * Most recent first.
 */
export async function fetchMyShareableMatches(): Promise<ShareableMatch[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error(t("errors.signedOut"));

  const now = Date.now();
  const { data, error } = await supabase
    .from("match_players")
    .select(`matches!inner(${MATCH_SELECT})`)
    .eq("player_id", user.id)
    .eq("matches.host_id", user.id)
    .eq("matches.status", "open")
    .gte("matches.starts_at", new Date(now - SHAREABLE_DAYS * 86_400_000).toISOString())
    .lte("matches.starts_at", new Date(now - STILL_PLAYING_MS).toISOString());
  if (error) throw error;

  const rows = (data as unknown as { matches: MatchRow }[])
    .map((row) => row.matches)
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const cards = await fetchPlayerCards(rows);

  return rows.flatMap((row): ShareableMatch[] => {
    const match = toMatchDetails(row, cards);
    // A match that never had 4 players wasn't played
    if (!match.isFull) return [];

    const endsAt = match.startsAt.getTime() + match.durationMinutes * 60_000;
    const { score } = match;
    let missing: ShareableMatch["missing"];
    if (!score) {
      if (now >= endsAt + SCORE_SAVE_WINDOW_MS) return [];
      missing = "score";
    } else if (score.status !== "expired" && !score.photoPath) {
      missing = "photo";
    } else {
      return [];
    }

    return [
      {
        id: match.id,
        playedAt: match.startsAt,
        clubName: match.clubName || t("match.yourMatch"),
        players: match.players.filter((player) => player.id !== user.id),
        missing,
      },
    ];
  });
}

/** Matches you played that are over and had all 4 players, most recent first. */
export async function fetchMyPastMatches(limit = PAST_MATCH_LIMIT): Promise<PastMatch[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error(t("errors.signedOut"));

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
    .slice(0, limit);
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
    // Seats 1–2 are team 1, seats 3–4 team 2
    const seats = match.seats ?? [];
    const mySeats = myTeam === 2 ? seats.slice(2) : seats.slice(0, 2);
    const theirSeats = myTeam === 2 ? seats.slice(0, 2) : seats.slice(2);
    return [
      {
        id: match.id,
        playedAt: match.startsAt,
        clubName: match.clubName || t("match.courtNotBooked"),
        courtName: match.courtName,
        kind: match.kind,
        partner: mySeats.find((player) => player !== undefined && player.id !== user.id),
        opponents: theirSeats.filter((player): player is Player => player !== undefined),
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
  if (!user) throw new Error(t("errors.signedOut"));

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
      levelMin: row.level_min,
      levelMax: row.level_max,
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
      return { id: guestId(row.id, seat), firstName: t("match.guest"), lastName: "" };
    }
    return undefined;
  });

  return {
    id: row.id,
    startsAt: new Date(row.starts_at),
    durationMinutes: row.duration_minutes,
    clubName: row.court?.club.name ?? "",
    clubId: row.court?.club.id,
    courtId: row.court?.id,
    courtName: row.court ? t("match.courtNumber", { number: row.court.number }) : undefined,
    isCourtBooked: row.court !== null,
    levelMin: row.level_min,
    levelMax: row.level_max,
    kind: row.kind,
    audience: row.audience,
    isLogged: row.origin === "logged",
    players: seats.filter((player): player is Player => player !== undefined),
    seats,
    capacity: CAPACITY,
    price: row.price ?? undefined,
    host: cards.get(row.host_id),
    note: row.note || undefined,
    hasJoinedPlayers: row.match_players.some((seat) => seat.player_id !== row.host_id),
    // The host and their guests, plus one row per player who joined
    isFull: row.match_players.length === row.players_needed + 1,
    score: row.score ? toMatchScore(row.score) : undefined,
    ratedBy: [...new Set(row.ratings.map((rating) => rating.rater_id))],
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
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at) : undefined,
    photoPath: row.photo_path ?? undefined,
  };
}
