import type { MatchDetails } from "@/types/match";

/** Games won in one set: [team 1 (seats 1–2), team 2 (seats 3–4)] */
export type SetScore = [number, number];

// A deciding third set can be a super tie-break instead: first to 10, two games clear
const SUPER_TIEBREAK_POINTS = 10;
const THIRD_SET = 2;

/** A set is won 6–0 to 6–4, 7–5 or 7–6 (tie-break). Same rule as the database. */
function isNormalSet([a, b]: SetScore) {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6));
}

/** First to 10 with two clear (10–8, 11–9, 10–3…), played instead of a third set. */
export function isSuperTiebreak([a, b]: SetScore) {
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  return Number.isInteger(high) && Number.isInteger(low) && low >= 0 && high >= SUPER_TIEBREAK_POINTS && (high === SUPER_TIEBREAK_POINTS ? low <= 8 : high - low === 2);
}

/** Whether one set's games are possible. Only the third set can be a super tie-break. */
export function isValidSet(set: SetScore, index: number) {
  return isNormalSet(set) || (index === THIRD_SET && isSuperTiebreak(set));
}

/** A team that won the first two sets has won the match, so no third set is played. */
export function isThirdSetPlayed(first: SetScore | undefined, second: SetScore | undefined) {
  if (!first || !second || !isValidSet(first, 0) || !isValidSet(second, 1)) return true;
  return first[0] > first[1] !== second[0] > second[1];
}

/** 1 or 2 when a team won the match, undefined when the score isn't complete or possible. */
export function winningTeam(sets: SetScore[]): 1 | 2 | undefined {
  if (sets.length < 2 || sets.length > 3) return undefined;
  const won = [0, 0];
  for (const set of sets) {
    // Nothing is played once a team has won two sets
    if (won[0] === 2 || won[1] === 2 || !isValidSet(set, won[0] + won[1])) return undefined;
    won[set[0] > set[1] ? 0 : 1] += 1;
  }
  if (won[0] === 2) return 1;
  if (won[1] === 2) return 2;
  return undefined;
}

/** "6–4 · 3–6 · 7–5", from the given team's side */
export function formatSets(sets: SetScore[], team: 1 | 2 = 1) {
  return sets.map(([a, b]) => (team === 1 ? `${a}–${b}` : `${b}–${a}`)).join(" · ");
}

/** 1 for seats 1–2, 2 for seats 3–4, undefined when the player isn't in the match */
export function teamOf(match: MatchDetails, playerId: string): 1 | 2 | undefined {
  const index = match.seats?.findIndex((player) => player?.id === playerId) ?? -1;
  if (index < 0) return undefined;
  return index < 2 ? 1 : 2;
}
