import { t } from "i18next";

import type { SetScore } from "@/lib/padel-score";
import type { LiveEntry, LiveMatch, LiveTournament, TournamentScore } from "@/types/tournament";

// The same rules as admin_save_tournament_score and the dashboard's tournament-engine.ts
const SET_GAMES = 4;
const SUPER_TIEBREAK_POINTS = 10;
export const WIN_POINTS = 2;
/** The top two of each group go through to the knockout */
export const QUALIFIERS_PER_GROUP = 2;

function validSet([a, b]: SetScore) {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return Number.isInteger(a) && Number.isInteger(b) && high === SET_GAMES && low >= 0 && low < SET_GAMES;
}

function validSuperTiebreak([a, b]: SetScore) {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (!Number.isInteger(a) || !Number.isInteger(b) || low < 0) return false;
  return high === SUPER_TIEBREAK_POINTS ? low <= SUPER_TIEBREAK_POINTS - 2 : high > SUPER_TIEBREAK_POINTS && high - low === 2;
}

function setsWon(score: TournamentScore) {
  let one = 0;
  let two = 0;
  for (const [a, b] of score.sets) {
    if (a > b) one++;
    else two++;
  }
  return { one, two };
}

/** Whether the two sets are one each, so a super tie-break decides it */
export function needsSuperTiebreak(sets: SetScore[]) {
  if (sets.length !== 2 || !sets.every(validSet)) return false;
  const { one, two } = setsWon({ sets });
  return one === 1 && two === 1;
}

/** What's wrong with a score, as a `tournaments.live.scoreError.*` key, or undefined when it's valid */
export function scoreError(score: TournamentScore) {
  if (score.sets.length !== 2) return "needSets" as const;
  if (!score.sets.every(validSet)) return "badSet" as const;
  if (needsSuperTiebreak(score.sets)) {
    if (!score.superTiebreak) return "needTiebreak" as const;
    if (!validSuperTiebreak(score.superTiebreak)) return "badTiebreak" as const;
  }
  return undefined;
}

/** 1 or 2, or undefined for a score that isn't valid */
export function scoreWinner(score: TournamentScore): 1 | 2 | undefined {
  if (scoreError(score)) return undefined;
  const { one, two } = setsWon(score);
  if (one === 2) return 1;
  if (two === 2) return 2;
  const [a, b] = score.superTiebreak as SetScore;
  return a > b ? 1 : 2;
}

/** The same score told from the other side */
export function flipScore(score: TournamentScore): TournamentScore {
  return {
    sets: score.sets.map(([a, b]) => [b, a]),
    superTiebreak: score.superTiebreak ? [score.superTiebreak[1], score.superTiebreak[0]] : undefined,
  };
}

/** "4-2 1-4 10-8", from one side */
export function scoreText(score: TournamentScore, side: 1 | 2 = 1) {
  const seen = side === 1 ? score : flipScore(score);
  return [...seen.sets, ...(seen.superTiebreak ? [seen.superTiebreak] : [])].map(([a, b]) => `${a}-${b}`).join(" ");
}

// ---------------------------------------------------------------------------------------------
// Standings: the same order as the dashboard (points, head-to-head of two, sets, games, draw order)

export type StandingRow = {
  entry: LiveEntry;
  played: number;
  wins: number;
  losses: number;
  setDiff: number;
  gameDiff: number;
  gamesFor: number;
  points: number;
  rank: number;
};

export function standings(entries: LiveEntry[], matches: LiveMatch[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    entries.map((entry) => [
      entry.id,
      { entry, played: 0, wins: 0, losses: 0, setDiff: 0, gameDiff: 0, gamesFor: 0, points: 0, rank: 0 },
    ]),
  );
  const beat = new Set<string>();

  for (const match of matches) {
    const one = match.entry1Id ? rows.get(match.entry1Id) : undefined;
    const two = match.entry2Id ? rows.get(match.entry2Id) : undefined;
    const winner = match.score ? scoreWinner(match.score) : undefined;
    if (!match.score || !one || !two || !winner) continue;

    const { one: sets1, two: sets2 } = setsWon(match.score);
    const tiebreak = match.score.superTiebreak ? (match.score.superTiebreak[0] > match.score.superTiebreak[1] ? 1 : 2) : 0;
    const setDiff = sets1 + (tiebreak === 1 ? 1 : 0) - (sets2 + (tiebreak === 2 ? 1 : 0));
    const games1 = match.score.sets.reduce((sum, [a]) => sum + a, 0);
    const games2 = match.score.sets.reduce((sum, [, b]) => sum + b, 0);

    one.played++;
    two.played++;
    one.setDiff += setDiff;
    two.setDiff -= setDiff;
    one.gameDiff += games1 - games2;
    two.gameDiff += games2 - games1;
    one.gamesFor += games1;
    two.gamesFor += games2;

    const [won, lost] = winner === 1 ? [one, two] : [two, one];
    won.wins++;
    won.points += WIN_POINTS;
    lost.losses++;
    beat.add(`${won.entry.id}>${lost.entry.id}`);
  }

  const onPoints = new Map<number, number>();
  for (const row of rows.values()) onPoints.set(row.points, (onPoints.get(row.points) ?? 0) + 1);

  const sorted = [...rows.values()].sort((a, b) => {
    if (a.points !== b.points) return b.points - a.points;
    if (onPoints.get(a.points) === 2) {
      if (beat.has(`${a.entry.id}>${b.entry.id}`)) return -1;
      if (beat.has(`${b.entry.id}>${a.entry.id}`)) return 1;
    }
    return b.setDiff - a.setDiff || b.gameDiff - a.gameDiff || b.gamesFor - a.gamesFor || a.entry.position - b.entry.position;
  });
  sorted.forEach((row, index) => {
    row.rank = index + 1;
  });
  return sorted;
}

export function groupLabels(tournament: LiveTournament) {
  return [...new Set(tournament.entries.map((entry) => entry.groupLabel).filter((label): label is string => !!label))].sort();
}

/** Every group's table, from the confirmed group scores */
export function groupTables(tournament: LiveTournament) {
  return groupLabels(tournament).map((label) => ({
    label,
    rows: standings(
      tournament.entries.filter((entry) => entry.groupLabel === label).sort((a, b) => a.position - b.position),
      tournament.matches.filter((match) => match.stage === "group" && match.groupLabel === label),
    ),
    matches: tournament.matches
      .filter((match) => match.stage === "group" && match.groupLabel === label)
      .sort((a, b) => a.round - b.round),
  }));
}

// ---------------------------------------------------------------------------------------------
// Stages, rounds and my matches

export type Stage = "groups" | "quarters" | "semis" | "final";

const STAGE_BY_MATCHES: Record<number, Stage> = { 4: "quarters", 2: "semis", 1: "final" };

/** The knockout rounds, first to last, each named by how many matches it has */
export function knockoutRounds(tournament: LiveTournament) {
  const knockout = tournament.matches.filter((match) => match.stage === "knockout");
  const rounds = [...new Set(knockout.map((match) => match.round))].sort((a, b) => a - b);
  return rounds.map((round) => {
    const matches = knockout.filter((match) => match.round === round).sort((a, b) => (a.label ?? "").localeCompare(b.label ?? ""));
    return { round, stage: STAGE_BY_MATCHES[matches.length] ?? ("quarters" as Stage), matches };
  });
}

/** Groups, then the knockout rounds 2 or 4 groups lead to */
export function stagesOf(tournament: LiveTournament): Stage[] {
  return tournament.groupCount === 2 ? ["groups", "semis", "final"] : ["groups", "quarters", "semis", "final"];
}

const isOpen = (match: LiveMatch) => !match.winnerEntryId;

/** The stage being played: the first knockout round with a match left, or the groups */
export function currentStage(tournament: LiveTournament): Stage {
  if (tournament.status === "finished") return "final";
  const open = knockoutRounds(tournament).find((round) => round.matches.some(isOpen));
  return open?.stage ?? (knockoutRounds(tournament).length > 0 ? "final" : "groups");
}

/** The group round being played, and how many there are */
export function groupRound(tournament: LiveTournament) {
  const group = tournament.matches.filter((match) => match.stage === "group");
  const total = Math.max(0, ...group.map((match) => match.round));
  const open = group.filter(isOpen).map((match) => match.round);
  return { current: open.length > 0 ? Math.min(...open) : total, total };
}

const STAGE_ORDER = { group: 0, knockout: 1, league: 2 } as const;

/** My matches in playing order: groups by round, then the knockout */
export function myMatches(tournament: LiveTournament) {
  return tournament.matches
    .filter((match) => match.mySide !== undefined)
    .sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.round - b.round);
}

/** My next match to play: both pairs known and no confirmed score yet */
export function nextMatchOf(tournament: LiveTournament) {
  return myMatches(tournament).find((match) => isOpen(match) && match.entry1Id && match.entry2Id);
}

export function entryById(tournament: LiveTournament, id: string | undefined) {
  return id ? tournament.entries.find((entry) => entry.id === id) : undefined;
}

export function playersOf(entry: LiveEntry | undefined) {
  return entry ? [entry.player1, entry.player2].filter((player) => player !== undefined) : [];
}

/** "Sami B. + Wael M.", or "You + Rami" for my own pair */
export function entryName(entry: LiveEntry | undefined, myEntryId?: string, myId?: string) {
  if (!entry) return t("tournaments.live.toBeDecided");
  const players = playersOf(entry);
  if (players.length === 0) return [entry.name1, entry.name2].filter(Boolean).join(" + ");
  if (entry.id === myEntryId) {
    const partner = players.find((player) => player.id !== myId);
    return [t("common.you"), partner?.firstName].filter(Boolean).join(" + ");
  }
  return players.map((player) => `${player.firstName} ${player.lastName.charAt(0)}.`).join(" + ");
}

/** "Winner of Semi-final 1" for a knockout slot nobody has reached yet */
export function waitingFor(tournament: LiveTournament, match: LiveMatch, slot: 1 | 2) {
  const feeder = tournament.matches.find((other) => other.nextMatchId === match.id && other.nextSlot === slot);
  return feeder?.label ? t("tournaments.live.winnerOf", { match: feeder.label }) : t("tournaments.live.toBeDecided");
}

/** "Group B, round 2" or "Semi-final 1" */
export function matchTitle(match: LiveMatch) {
  if (match.stage === "group") return t("tournaments.live.groupRound", { group: match.groupLabel, round: match.round });
  return match.label ?? t("tournaments.live.knockout");
}

/** Whether I can send this match's score now */
export function canSendScore(tournament: LiveTournament, match: LiveMatch) {
  return tournament.status === "live" && match.mySide !== undefined && isOpen(match) && !!match.entry1Id && !!match.entry2Id;
}
