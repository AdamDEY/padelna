import { supabase } from "@/lib/supabase";
import type {
  AmericanoScoreMode,
  LiveEntry,
  LiveMatch,
  LiveTournament,
  PartnerCandidate,
  TournamentCategory,
  TournamentDetail,
  TournamentEntryMode,
  TournamentEntryStatus,
  TournamentFit,
  TournamentFormat,
  TournamentPlayer,
  TournamentScore,
  TournamentStatus,
  TournamentSummary,
  TournamentTeam,
} from "@/types/tournament";

type SummaryRow = {
  id: string;
  name: string;
  format: TournamentFormat;
  /** Missing before migration 20261109200000 */
  status?: TournamentStatus;
  category: TournamentCategory;
  entry_mode: TournamentEntryMode | null;
  starts_at: string | null;
  club_name: string | null;
  capacity: number | null;
  entries_count: number;
  spots_left: number | null;
  waitlist_count: number;
  registration_open: boolean;
  my_status: TournamentEntryStatus | null;
};

type PlayerJson = {
  id: string;
  first_name: string;
  last_name: string;
  level: number | null;
  avatar_url: string | null;
  coach_verified: boolean;
  is_friend: boolean;
};

type TeamJson = {
  id: string;
  status: TournamentEntryStatus;
  joined_at: string;
  name1: string;
  name2: string | null;
  player1: PlayerJson | null;
  player2: PlayerJson | null;
  team_level: number | null;
};

type DetailJson = {
  tournament: {
    id: string;
    name: string;
    format: TournamentFormat;
    status: TournamentDetail["status"];
    category: TournamentCategory;
    settings: { group_count?: number; entry_mode?: TournamentEntryMode } | null;
    starts_at: string | null;
    ends_at: string | null;
    club_id: string | null;
    club_name: string | null;
    club_city: string | null;
    capacity: number | null;
    level_min: number | null;
    level_max: number | null;
    registration_closes_at: string | null;
    entry_fee: number | null;
    check_in_note: string | null;
    prizes: string | null;
    prizes_note: string | null;
    organiser_name: string | null;
    notes: string | null;
  };
  registration_open: boolean;
  entries_count: number;
  spots_left: number | null;
  waitlist_count: number;
  looking_count: number;
  my_fit: TournamentFit | null;
  my_level: number | null;
  my_entry: {
    id: string;
    status: TournamentEntryStatus;
    role: "captain" | "partner";
    partner: PlayerJson | null;
    invite_expires_at: string | null;
  } | null;
  avg_level: number | null;
  teams: TeamJson[];
};

type CandidateRow = {
  id: string;
  first_name: string;
  last_name: string;
  level: number | null;
  avatar_url: string | null;
  matches_together: number;
  fit: TournamentFit;
};

const toDate = (value: string | null) => (value ? new Date(value) : undefined);

function toPlayer(json: PlayerJson | null): TournamentPlayer | undefined {
  if (!json) return undefined;
  return {
    id: json.id,
    firstName: json.first_name,
    lastName: json.last_name,
    level: json.level ?? undefined,
    avatarUrl: json.avatar_url ?? undefined,
    coachVerified: json.coach_verified,
    isFriend: json.is_friend,
  };
}

function toTeam(json: TeamJson): TournamentTeam {
  return {
    id: json.id,
    status: json.status,
    joinedAt: new Date(json.joined_at),
    name1: json.name1,
    name2: json.name2 ?? undefined,
    player1: toPlayer(json.player1),
    player2: toPlayer(json.player2),
    teamLevel: json.team_level ?? undefined,
  };
}

/** Live tournaments first, then those still open for entries, soonest first. */
export async function fetchTournaments(): Promise<TournamentSummary[]> {
  const { data, error } = await supabase.rpc("get_tournaments");
  if (error) throw error;
  return (data as SummaryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    format: row.format,
    status: row.status ?? "setup",
    category: row.category,
    entryMode: row.entry_mode ?? undefined,
    startsAt: toDate(row.starts_at),
    clubName: row.club_name ?? undefined,
    capacity: row.capacity ?? undefined,
    entriesCount: row.entries_count,
    spotsLeft: row.spots_left ?? undefined,
    waitlistCount: row.waitlist_count,
    registrationOpen: row.registration_open,
    myStatus: row.my_status ?? undefined,
  }));
}

/** The Tournament detail screen; null if the tournament doesn't exist. */
export async function fetchTournament(id: string): Promise<TournamentDetail | null> {
  const { data, error } = await supabase.rpc("get_tournament", { p_id: id });
  if (error) throw error;
  if (!data) return null;
  const json = data as DetailJson;
  const { tournament } = json;
  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    status: tournament.status,
    category: tournament.category,
    entryMode: tournament.settings?.entry_mode,
    groupCount: tournament.settings?.group_count,
    startsAt: toDate(tournament.starts_at),
    endsAt: toDate(tournament.ends_at),
    clubId: tournament.club_id ?? undefined,
    clubName: tournament.club_name ?? undefined,
    clubCity: tournament.club_city ?? undefined,
    capacity: tournament.capacity ?? undefined,
    levelMin: tournament.level_min ?? undefined,
    levelMax: tournament.level_max ?? undefined,
    registrationClosesAt: toDate(tournament.registration_closes_at),
    entryFee: tournament.entry_fee ?? undefined,
    checkInNote: tournament.check_in_note ?? undefined,
    prizes: tournament.prizes ?? undefined,
    prizesNote: tournament.prizes_note ?? undefined,
    organiserName: tournament.organiser_name ?? undefined,
    notes: tournament.notes ?? undefined,
    registrationOpen: json.registration_open,
    entriesCount: json.entries_count,
    spotsLeft: json.spots_left ?? undefined,
    waitlistCount: json.waitlist_count,
    lookingCount: json.looking_count,
    myFit: json.my_fit ?? undefined,
    myLevel: json.my_level ?? undefined,
    myStatus: json.my_entry?.status,
    myEntry: json.my_entry
      ? {
          id: json.my_entry.id,
          status: json.my_entry.status,
          role: json.my_entry.role,
          partner: toPlayer(json.my_entry.partner),
          inviteExpiresAt: toDate(json.my_entry.invite_expires_at),
        }
      : undefined,
    avgLevel: json.avg_level ?? undefined,
    teams: json.teams.map(toTeam),
  };
}

/** My friends, the ones who can play first. */
export async function fetchPartnerCandidates(tournamentId: string): Promise<PartnerCandidate[]> {
  const { data, error } = await supabase.rpc("get_tournament_partner_candidates", {
    p_tournament_id: tournamentId,
  });
  if (error) throw error;
  return (data as CandidateRow[]).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    level: row.level ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    matchesTogether: row.matches_together,
    fit: row.fit,
  }));
}

/** Invites a friend. On a full tournament the pair goes on the waitlist once the friend accepts. */
export async function joinTournament(tournamentId: string, partnerId: string): Promise<TournamentEntryStatus> {
  const { data, error } = await supabase.rpc("join_tournament", {
    p_tournament_id: tournamentId,
    p_partner_id: partnerId,
  });
  if (error) throw error;
  return (data as { status: TournamentEntryStatus }).status;
}

export async function joinTournamentPartnerList(tournamentId: string) {
  const { error } = await supabase.rpc("join_tournament_partner_list", { p_tournament_id: tournamentId });
  if (error) throw error;
}

export async function respondToTournamentInvite(entryId: string, accept: boolean) {
  const { error } = await supabase.rpc("respond_to_tournament_invite", {
    p_entry_id: entryId,
    p_accept: accept,
  });
  if (error) throw error;
}

/** The whole pair drops out. */
export async function leaveTournament(tournamentId: string) {
  const { error } = await supabase.rpc("leave_tournament", { p_tournament_id: tournamentId });
  if (error) throw error;
}

type ScoreJson = [number, number][] | null;

type LiveJson = {
  tournament: {
    id: string;
    name: string;
    format: TournamentFormat;
    status: TournamentStatus;
    category: TournamentCategory;
    starts_at: string | null;
    group_count: number | null;
    /** Missing before migration 20261109210000 */
    entry_mode?: TournamentEntryMode | null;
    score_mode?: AmericanoScoreMode | null;
    rounds?: number | null;
    club_id: string | null;
    club_name: string | null;
    organiser_name: string | null;
    notes: string | null;
  };
  my_entry_id: string | null;
  entries: {
    id: string;
    name1: string;
    name2: string | null;
    group_label: string | null;
    position: number;
    player1: PlayerJson | null;
    player2: PlayerJson | null;
  }[];
  matches: {
    id: string;
    stage: LiveMatch["stage"];
    group_label: string | null;
    round: number;
    label: string | null;
    entry1_id: string | null;
    entry2_id: string | null;
    sets: ScoreJson;
    super_tiebreak: [number, number] | null;
    winner_entry_id: string | null;
    next_match_id: string | null;
    next_slot: 1 | 2 | null;
    submitted_sets: ScoreJson;
    submitted_super_tiebreak: [number, number] | null;
    submitted_by_me: boolean;
    my_side: 1 | 2 | null;
    side1_players?: string[] | null;
    side2_players?: string[] | null;
    winner_side?: 1 | 2 | null;
    scored_by_me?: boolean | null;
  }[];
};

function toScore(sets: ScoreJson, superTiebreak: [number, number] | null): TournamentScore | undefined {
  if (!sets) return undefined;
  return { sets, superTiebreak: superTiebreak ?? undefined };
}

/** A live or finished tournament; null before it starts or once it's gone. */
export async function fetchTournamentLive(id: string): Promise<LiveTournament | null> {
  const { data, error } = await supabase.rpc("get_tournament_live", { p_id: id });
  if (error) throw error;
  if (!data) return null;
  const { tournament, my_entry_id, entries, matches } = data as LiveJson;
  return {
    id: tournament.id,
    name: tournament.name,
    format: tournament.format,
    status: tournament.status,
    category: tournament.category,
    startsAt: toDate(tournament.starts_at),
    groupCount: tournament.group_count ?? undefined,
    entryMode: tournament.entry_mode ?? undefined,
    scoreMode: tournament.score_mode ?? undefined,
    rounds: tournament.rounds ?? undefined,
    clubId: tournament.club_id ?? undefined,
    clubName: tournament.club_name ?? undefined,
    organiserName: tournament.organiser_name ?? undefined,
    notes: tournament.notes ?? undefined,
    myEntryId: my_entry_id ?? undefined,
    entries: entries.map(
      (entry): LiveEntry => ({
        id: entry.id,
        name1: entry.name1,
        name2: entry.name2 ?? undefined,
        groupLabel: entry.group_label ?? undefined,
        position: entry.position,
        player1: toPlayer(entry.player1),
        player2: toPlayer(entry.player2),
      }),
    ),
    matches: matches.map(
      (match): LiveMatch => ({
        id: match.id,
        stage: match.stage,
        groupLabel: match.group_label ?? undefined,
        round: match.round,
        label: match.label ?? undefined,
        entry1Id: match.entry1_id ?? undefined,
        entry2Id: match.entry2_id ?? undefined,
        // A group or knockout score counts once it has a winner; an Americano one once it has a winning side
        score: match.winner_entry_id || match.winner_side ? toScore(match.sets ?? [], match.super_tiebreak) : undefined,
        winnerEntryId: match.winner_entry_id ?? undefined,
        nextMatchId: match.next_match_id ?? undefined,
        nextSlot: match.next_slot ?? undefined,
        submitted: toScore(match.submitted_sets, match.submitted_super_tiebreak),
        submittedByMe: match.submitted_by_me,
        mySide: match.my_side ?? undefined,
        side1Players: match.side1_players ?? undefined,
        side2Players: match.side2_players ?? undefined,
        winnerSide: match.winner_side ?? undefined,
        scoredByMe: match.scored_by_me ?? false,
      }),
    ),
  };
}

/** Sends a match score for the organiser to confirm, written from side 1 of the match. */
export async function submitTournamentScore(matchId: string, score: TournamentScore) {
  const { error } = await supabase.rpc("submit_tournament_score", {
    p_match_id: matchId,
    p_sets: score.sets,
    p_super_tiebreak: score.superTiebreak ?? null,
  });
  if (error) throw error;
}

/** Joins an individual Americano alone; on a full one, the waitlist. */
export async function joinTournamentSolo(tournamentId: string): Promise<TournamentEntryStatus> {
  const { data, error } = await supabase.rpc("join_tournament_solo", { p_tournament_id: tournamentId });
  if (error) throw error;
  return data as TournamentEntryStatus;
}

/** An Americano score, from side 1: it counts right away. */
export async function submitAmericanoScore(matchId: string, score: TournamentScore) {
  const { error } = await supabase.rpc("submit_americano_score", {
    p_match_id: matchId,
    p_sets: score.sets,
    p_super_tiebreak: score.superTiebreak ?? null,
  });
  if (error) throw error;
}
