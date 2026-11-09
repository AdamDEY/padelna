import { daysUntil } from "@/lib/format-date";
import type { TournamentSummary } from "@/types/tournament";

/** A group stage is always pairs; an Americano is individual unless it was set up in pairs. */
export function isIndividual(tournament: Pick<TournamentSummary, "format" | "entryMode">) {
  return tournament.format === "americano" && tournament.entryMode !== "pairs";
}

/** Which word counts the entries: `tournaments.unit.*` */
export function entryUnit(tournament: Pick<TournamentSummary, "format" | "entryMode">) {
  if (tournament.format === "groups") return "teams" as const;
  return isIndividual(tournament) ? ("players" as const) : ("pairs" as const);
}

/** Spots this few or under get the sand chip (design "Tournaments · all") */
const FEW_SPOTS_LEFT = 4;

export function hasFewSpots(spotsLeft: number) {
  return spotsLeft <= FEW_SPOTS_LEFT;
}

/** Home has room for a few: an invite to answer first, then yours, then those you can still join. */
export function forHome<T extends Pick<TournamentSummary, "myStatus" | "registrationOpen">>(tournaments: T[]) {
  const rank = ({ myStatus, registrationOpen }: T) =>
    myStatus === "invited" || myStatus === "waitlist_invited" ? 0 : myStatus ? 1 : registrationOpen ? 2 : 3;
  return [...tournaments].sort((a, b) => rank(a) - rank(b));
}

/** Until the coming Sunday night, or later */
export function isThisWeek(date: Date, now = new Date()) {
  const daysToSunday = (7 - now.getDay()) % 7;
  return daysUntil(date, now) <= daysToSunday;
}

/** "60", or "62.50" when there are millimes */
export function formatFee(fee: number) {
  return Number.isInteger(fee) ? String(fee) : fee.toFixed(2);
}

/** "6.0", "4.5", or "4.75" for a pair between two half levels */
export function formatTeamLevel(level: number) {
  return level.toFixed(Number.isInteger(level * 10) ? 1 : 2);
}
