import { t } from "i18next";

import { formatMatchDay } from "@/lib/format-date";
import { teamOf, winningTeam, type SetScore } from "@/lib/padel-score";
import type { MatchDetails, MatchScore, PastMatch } from "@/types/match";
import type { Player } from "@/types/player";

/** The four looks of the overlay (design: Share your match, the style thumbnails). */
export const SHARE_STYLES = ["score", "stats", "minimal", "streak"] as const;
export type ShareStyle = (typeof SHARE_STYLES)[number];

/** What sits behind the overlay: your photo, nothing (a sticker for your own story), or a plain colour. */
export type ShareBackdrop = "photo" | "sticker" | "plain";

// The Streak style shows the last five results, like the design's W L W W W
const FORM_LENGTH = 5;

type Result = "won" | "lost";

/** Everything the share overlay shows, told from the sharing player's side. */
export type MatchShareData = {
  result: Result;
  /** Sets won / lost by my team, e.g. 2 and 1 */
  setsWon: number;
  setsLost: number;
  /** Games per set as [my team, their team] */
  sets: SetScore[];
  myTeam: string;
  theirTeam: string;
  /** "Lac Padel Arena · Sun 19 Oct" */
  place: string;
  /** "Sun 19 Oct · Lac Padel Arena" */
  dateFirst: string;
  /** Run of the same result up to and including this match */
  streak: { result: Result; count: number };
  /** The last results ending with this match, oldest first */
  form: Result[];
};

function teamNames(team: Player[], myId: string) {
  const mine = team.find((player) => player.id === myId);
  const others = team.filter((player) => player !== mine).map((player) => player.firstName);
  return (mine ? [t("common.you"), ...others] : others).join(" + ");
}

/**
 * The share picture's numbers for a match with a score, or undefined when I'm not one of its
 * players or the score can't be read. `history` is my confirmed past matches (any order); it
 * only feeds the streak and the last results.
 */
export function buildMatchShare(
  match: MatchDetails & { score: MatchScore },
  myId: string,
  history: PastMatch[],
): MatchShareData | undefined {
  const myTeam = teamOf(match, myId);
  if (!myTeam) return undefined;

  const mine = (set: SetScore): SetScore => (myTeam === 1 ? set : [set[1], set[0]]);
  const sets = match.score.sets.map(mine);
  const setsWon = sets.filter(([a, b]) => a > b).length;
  const setsLost = sets.filter(([a, b]) => b > a).length;
  const winner = winningTeam(match.score.sets);
  const won = winner ? winner === myTeam : setsWon > setsLost;

  const seats = match.seats ?? match.players;
  const players = (from: number, to: number) =>
    seats.slice(from, to).filter((player): player is Player => player !== undefined);
  const mySeats = myTeam === 1 ? players(0, 2) : players(2, 4);
  const theirSeats = myTeam === 1 ? players(2, 4) : players(0, 2);

  // Earlier results come from the history; this match counts as the newest even while its
  // score still waits for the other team
  const earlier = history
    .filter((past) => past.id !== match.id && past.playedAt < match.startsAt)
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .flatMap((past) => (past.result === "won" || past.result === "lost" ? [past.result] : []));
  const result: Result = won ? "won" : "lost";
  const newestFirst: Result[] = [result, ...earlier];
  let count = 0;
  while (newestFirst[count] === result) count += 1;

  const day = formatMatchDay(match.startsAt);
  const club = match.clubName || t("match.courtNotBooked");

  return {
    result,
    setsWon,
    setsLost,
    sets,
    myTeam: teamNames(mySeats, myId),
    theirTeam: teamNames(theirSeats, myId),
    place: `${club} · ${day}`,
    dateFirst: `${day} · ${club}`,
    streak: { result, count },
    form: newestFirst.slice(0, FORM_LENGTH).reverse(),
  };
}

/** Whether a match's score can be shared: it's sent and hasn't run out of time. */
export function canShareScore(score: MatchScore | undefined): score is MatchScore {
  return score !== undefined && score.status !== "expired";
}
