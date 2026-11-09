import { supabase } from "@/lib/supabase";
import type {
  PartnerCandidate,
  TournamentCategory,
  TournamentDetail,
  TournamentEntryMode,
  TournamentEntryStatus,
  TournamentFit,
  TournamentFormat,
  TournamentPlayer,
  TournamentSummary,
  TournamentTeam,
} from "@/types/tournament";

type SummaryRow = {
  id: string;
  name: string;
  format: TournamentFormat;
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

/** Tournaments still open for entries, soonest first. */
export async function fetchTournaments(): Promise<TournamentSummary[]> {
  const { data, error } = await supabase.rpc("get_tournaments");
  if (error) throw error;
  return (data as SummaryRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    format: row.format,
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
