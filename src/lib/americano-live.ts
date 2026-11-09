import type { SetScore } from "@/lib/padel-score";
import type { AmericanoScoreMode, LiveEntry, LiveMatch, LiveTournament, TournamentScore } from "@/types/tournament";

// The same rules as admin_save_tournament_score and the dashboard's tournament-engine.ts
const SET_GAMES = 4;
const SUPER_TIEBREAK_POINTS = 10;

/** One set to 4 games unless the organiser chose a super tie-break */
export const scoreModeOf = (tournament: LiveTournament): AmericanoScoreMode => tournament.scoreMode ?? "set4";

/** The two numbers a match was played for: the set's games, or the tie-break's points */
export function pointsOf(mode: AmericanoScoreMode, score: TournamentScore): SetScore | undefined {
  return mode === "set4" ? score.sets[0] : score.superTiebreak;
}

/** What's wrong with the two numbers, as a `tournaments.americano.scoreError.*` key, or undefined */
export function americanoScoreError(mode: AmericanoScoreMode, [a, b]: SetScore) {
  if (!Number.isInteger(a) || !Number.isInteger(b)) return "missing" as const;
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  if (mode === "set4") return high === SET_GAMES && low >= 0 && low < SET_GAMES ? undefined : ("badSet" as const);
  const valid = high === SUPER_TIEBREAK_POINTS ? low >= 0 && low <= SUPER_TIEBREAK_POINTS - 2 : high > SUPER_TIEBREAK_POINTS && high - low === 2;
  return valid ? undefined : ("badTiebreak" as const);
}

/** The score the database expects, from side 1 */
export function toAmericanoScore(mode: AmericanoScoreMode, points: SetScore): TournamentScore {
  return mode === "set4" ? { sets: [points] } : { sets: [], superTiebreak: points };
}

// ---------------------------------------------------------------------------------------------
// Rounds

export const sidesOf = (match: LiveMatch) => [match.side1Players ?? [], match.side2Players ?? []] as const;

/** Every Americano match, round by round */
export function americanoMatches(tournament: LiveTournament) {
  return tournament.matches.filter((match) => match.stage === "league" && match.side1Players).sort((a, b) => a.round - b.round);
}

export function roundCount(tournament: LiveTournament) {
  return tournament.rounds ?? Math.max(0, ...americanoMatches(tournament).map((match) => match.round));
}

const isScored = (match: LiveMatch) => match.winnerSide !== undefined;

/** The round being played: the first one with a match left to score */
export function currentRound(tournament: LiveTournament) {
  const open = americanoMatches(tournament).filter((match) => !isScored(match));
  return open.length > 0 ? Math.min(...open.map((match) => match.round)) : roundCount(tournament);
}

/** Rounds whose every match has a score */
export function roundsPlayed(tournament: LiveTournament) {
  const total = roundCount(tournament);
  let played = 0;
  for (let round = 1; round <= total; round++) {
    const matches = americanoMatches(tournament).filter((match) => match.round === round);
    if (matches.length > 0 && matches.every(isScored)) played = round;
    else break;
  }
  return played;
}

export function myMatchIn(tournament: LiveTournament, round: number) {
  return americanoMatches(tournament).find((match) => match.round === round && match.mySide !== undefined);
}

export function myMatches(tournament: LiveTournament) {
  return americanoMatches(tournament).filter((match) => match.mySide !== undefined);
}

export function entryOf(tournament: LiveTournament, id: string | undefined) {
  return id ? tournament.entries.find((entry) => entry.id === id) : undefined;
}

/** My partner, and the two players across the net, in a match I play */
export function lineUp(tournament: LiveTournament, match: LiveMatch) {
  const [one, two] = sidesOf(match);
  const mine = match.mySide === 2 ? two : one;
  const theirs = match.mySide === 2 ? one : two;
  return {
    partner: entryOf(tournament, mine.find((id) => id !== tournament.myEntryId)),
    opponents: theirs.map((id) => entryOf(tournament, id)).filter((entry): entry is LiveEntry => !!entry),
  };
}

/** "Sami B.", or the typed name of a player without an account */
export function shortName(entry: LiveEntry | undefined) {
  if (!entry) return "";
  if (entry.player1) return `${entry.player1.firstName} ${entry.player1.lastName.charAt(0)}.`;
  const [first, ...rest] = entry.name1.split(" ");
  return rest.length > 0 ? `${first} ${rest.join(" ").charAt(0)}.` : first;
}

export function fullName(entry: LiveEntry) {
  return entry.player1 ? `${entry.player1.firstName} ${entry.player1.lastName}` : entry.name1;
}

/** "14-18", from one side */
export function americanoScoreText(mode: AmericanoScoreMode, score: TournamentScore, side: 1 | 2 = 1) {
  const points = pointsOf(mode, score);
  if (!points) return "";
  const [a, b] = side === 1 ? points : [points[1], points[0]];
  return `${a}-${b}`;
}

// ---------------------------------------------------------------------------------------------
// Leaderboard: games or points won, then wins, then the difference (same order as the dashboard)

export type LeaderRow = {
  entry: LiveEntry;
  played: number;
  wins: number;
  scored: number;
  conceded: number;
  rank: number;
  /** Places gained (+) or lost (−) since the last finished round; undefined before then */
  moved?: number;
};

function rank(tournament: LiveTournament, upToRound: number): LeaderRow[] {
  const mode = scoreModeOf(tournament);
  const rows = new Map<string, LeaderRow>(
    tournament.entries.map((entry) => [entry.id, { entry, played: 0, wins: 0, scored: 0, conceded: 0, rank: 0 }]),
  );

  for (const match of americanoMatches(tournament)) {
    if (match.round > upToRound || !match.score || !match.winnerSide) continue;
    const points = pointsOf(mode, match.score);
    if (!points) continue;
    const [a, b] = points;
    sidesOf(match).forEach((team, index) => {
      const side = index === 0 ? 1 : 2;
      for (const id of team) {
        const row = rows.get(id);
        if (!row) continue;
        row.played++;
        row.scored += side === 1 ? a : b;
        row.conceded += side === 1 ? b : a;
        if (match.winnerSide === side) row.wins++;
      }
    });
  }

  const sorted = [...rows.values()].sort(
    (x, y) =>
      y.scored - x.scored ||
      y.wins - x.wins ||
      y.scored - y.conceded - (x.scored - x.conceded) ||
      x.entry.position - y.entry.position,
  );
  sorted.forEach((row, index) => {
    row.rank = index + 1;
  });
  return sorted;
}

/**
 * The leaderboard now, with how far each player moved since the last round that finished before
 * the latest scores: the end of the last full round while the next one is being scored, or the
 * round before it once that round is complete.
 */
export function leaderboard(tournament: LiveTournament): LeaderRow[] {
  const now = rank(tournament, Infinity);
  const played = roundsPlayed(tournament);
  const scoredLater = americanoMatches(tournament).some((match) => match.round > played && isScored(match));
  const baseline = scoredLater ? played : played - 1;
  if (baseline < 1) return now;
  const before = new Map(rank(tournament, baseline).map((row) => [row.entry.id, row.rank]));
  return now.map((row) => ({ ...row, moved: (before.get(row.entry.id) ?? row.rank) - row.rank }));
}

/** Whether I can enter this match's score: I play it and the tournament is live */
export function canEnterScore(tournament: LiveTournament, match: LiveMatch) {
  return tournament.status === "live" && match.mySide !== undefined;
}
