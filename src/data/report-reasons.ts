/**
 * Why a player can be reported (design canvas "Report a player"), in the order they show.
 * Same list as the check on `player_reports.reason` in the database; the readable names are in
 * `reportPlayer.reasons` in the locale files.
 */
export const REPORT_REASONS = [
  "sabotage",
  "fake_score",
  "unfair_rating",
  "wrong_level",
  "no_show",
  "abusive",
  "other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

// Longest comment that goes with a report
export const MAX_REPORT_COMMENT = 300;
