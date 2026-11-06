import type { ReviewScores } from "@/types/club";

/**
 * The court things a player rates, then the club things; `key` is the column in `club_reviews`.
 * Glass & walls and Lighting are left out for now; their columns stay in the table.
 */
export const courtAspects = [
  { key: "surface", label: "Court surface" },
] as const satisfies readonly { key: keyof ReviewScores; label: string }[];

export const clubAspects = [
  { key: "gear", label: "Rackets & balls" },
  { key: "rooms", label: "Changing rooms" },
  { key: "staff", label: "Staff & welcome" },
] as const satisfies readonly { key: keyof ReviewScores; label: string }[];

export const ratingAspects = [...courtAspects, ...clubAspects];
