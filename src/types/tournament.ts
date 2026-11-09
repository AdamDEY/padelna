import type { Player } from "@/types/player";

export type TournamentCategory = "men" | "women" | "mixed";
export type TournamentFormat = "groups" | "americano";
/** Same as `settings.entry_mode`; a group stage has no mode and is always pairs */
export type TournamentEntryMode = "pairs" | "players" | "individual";

/**
 * confirmed = a full pair holding a spot; invited = the partner has 24 hours and the spot is held;
 * waitlist_invited = the same, on a full tournament; waitlist = a full pair waiting;
 * looking = a single player on the partner list
 */
export type TournamentEntryStatus = "confirmed" | "invited" | "waitlist_invited" | "waitlist" | "looking";

/** Whether a player can be in a pair of this tournament */
export type TournamentFit = "ok" | "already_in_team" | "wrong_category" | "below_range" | "above_range";

/** A tournament on Home and in the Tournaments list. */
export type TournamentSummary = {
  id: string;
  name: string;
  format: TournamentFormat;
  category: TournamentCategory;
  entryMode?: TournamentEntryMode;
  startsAt?: Date;
  clubName?: string;
  /** Missing until the admin sets it; the tournament can't be joined before that */
  capacity?: number;
  entriesCount: number;
  spotsLeft?: number;
  waitlistCount: number;
  registrationOpen: boolean;
  myStatus?: TournamentEntryStatus;
};

export type TournamentPlayer = Player & {
  coachVerified: boolean;
  isFriend: boolean;
};

/** A pair holding a spot. Pairs typed by name before player accounts have no players, only names. */
export type TournamentTeam = {
  id: string;
  status: TournamentEntryStatus;
  joinedAt: Date;
  name1: string;
  name2?: string;
  player1?: TournamentPlayer;
  player2?: TournamentPlayer;
  teamLevel?: number;
};

export type MyTournamentEntry = {
  id: string;
  status: TournamentEntryStatus;
  /** "captain" sent the invite or is on the partner list; "partner" received the invite */
  role: "captain" | "partner";
  partner?: TournamentPlayer;
  inviteExpiresAt?: Date;
};

export type TournamentDetail = TournamentSummary & {
  status: "setup" | "live" | "finished";
  clubId?: string;
  clubCity?: string;
  groupCount?: number;
  levelMin?: number;
  levelMax?: number;
  registrationClosesAt?: Date;
  endsAt?: Date;
  /** TND per team */
  entryFee?: number;
  checkInNote?: string;
  prizes?: string;
  prizesNote?: string;
  organiserName?: string;
  notes?: string;
  lookingCount: number;
  myFit?: TournamentFit;
  myLevel?: number;
  myEntry?: MyTournamentEntry;
  avgLevel?: number;
  teams: TournamentTeam[];
};

/** A friend in "Who is your partner?" */
export type PartnerCandidate = Player & {
  matchesTogether: number;
  fit: TournamentFit;
};
