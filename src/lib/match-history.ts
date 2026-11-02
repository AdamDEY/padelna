import { formatMonthName } from "@/lib/format-date";
import type { PastMatch } from "@/types/match";

export type HistoryResult = "won" | "lost";

/** Win or loss from the games you took, for scores that aren't confirmed yet */
export function resultOfSets(sets: PastMatch["sets"]): HistoryResult | undefined {
  const mine = sets.filter(([a, b]) => a > b).length;
  const theirs = sets.filter(([a, b]) => b > a).length;
  if (mine === theirs) return undefined;
  return mine > theirs ? "won" : "lost";
}

/** What the row shows: confirmed results, or the claimed score while it waits for the other team */
export function shownResult(match: PastMatch): HistoryResult | undefined {
  if (match.result === "won" || match.result === "lost") return match.result;
  if (match.result === "unconfirmed") return resultOfSets(match.sets);
  return undefined;
}

export function summarize(matches: PastMatch[]) {
  const won = matches.filter((match) => match.result === "won").length;
  const lost = matches.filter((match) => match.result === "lost").length;
  const decided = won + lost;

  // Current run of the same result, newest first
  const results = matches.flatMap((match) => (match.result === "won" || match.result === "lost" ? [match.result] : []));
  const first = results[0];
  let run = 0;
  while (first && results[run] === first) run += 1;

  return {
    won,
    lost,
    winRate: decided > 0 ? Math.round((won / decided) * 100) : undefined,
    lastTen: results.slice(0, 10),
    streak: first ? { result: first, count: run } : undefined,
  };
}

export type MonthGroup = {
  key: string;
  label: string;
  matches: PastMatch[];
  won: number;
  lost: number;
};

/** Newest month first; `matches` is already newest first. */
export function groupByMonth(matches: PastMatch[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const match of matches) {
    const key = `${match.playedAt.getFullYear()}-${match.playedAt.getMonth()}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: formatMonthName(match.playedAt), matches: [], won: 0, lost: 0 };
      groups.push(group);
    }
    group.matches.push(match);
    if (match.result === "won") group.won += 1;
    if (match.result === "lost") group.lost += 1;
  }
  return groups;
}

/** "Mehdi & Salma" */
export function namesOf(players: { firstName: string }[]) {
  return players.map((player) => player.firstName).join(" & ");
}
