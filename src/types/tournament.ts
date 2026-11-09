import type { SetScore } from "@/lib/padel-score";
import type { Player } from "@/types/player";

export type TournamentCategory = "men" | "women" | "mixed";
export type TournamentStatus = "setup" | "live" | "finished";
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
  status: TournamentStatus;
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

/** A tournament score: two sets to 4, then a super tie-break when the sets are one each. */
export type TournamentScore = { sets: SetScore[]; superTiebreak?: SetScore };

/** A pair in a live tournament; pairs typed by name before player accounts have names only. */
export type LiveEntry = {
  id: string;
  name1: string;
  name2?: string;
  groupLabel?: string;
  position: number;
  player1?: TournamentPlayer;
  player2?: TournamentPlayer;
};

export type LiveMatch = {
  id: string;
  stage: "group" | "knockout" | "league";
  groupLabel?: string;
  /** Round inside the group, or the knockout round (1 = first) */
  round: number;
  label?: string;
  entry1Id?: string;
  entry2Id?: string;
  /** Confirmed by the organiser, from side 1 */
  score?: TournamentScore;
  winnerEntryId?: string;
  nextMatchId?: string;
  nextSlot?: 1 | 2;
  /** Sent by a player and waiting for the organiser, from side 1 */
  submitted?: TournamentScore;
  submittedByMe: boolean;
  /** Which side the signed-in player is on, if they play this match */
  mySide?: 1 | 2;
  /** Individual Americano: the two players (entry ids) on each side, and the side that won */
  side1Players?: string[];
  side2Players?: string[];
  winnerSide?: 1 | 2;
  /** Individual Americano: I entered the score that's there now */
  scoredByMe: boolean;
};

/** How an Americano match is scored: one set to 4 games, or a super tie-break to 10 */
export type AmericanoScoreMode = "set4" | "supertiebreak";

/** A live or finished tournament, as the live screens show it. */
export type LiveTournament = {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  category: TournamentCategory;
  startsAt?: Date;
  groupCount?: number;
  entryMode?: TournamentEntryMode;
  scoreMode?: AmericanoScoreMode;
  /** Americano: how many rounds were drawn */
  rounds?: number;
  clubId?: string;
  clubName?: string;
  organiserName?: string;
  notes?: string;
  myEntryId?: string;
  entries: LiveEntry[];
  matches: LiveMatch[];
};
