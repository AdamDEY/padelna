import { teamOf } from "@/lib/padel-score";
import type { MatchDetails, MatchScore } from "@/types/match";
import type { Player } from "@/types/player";

// Rating closes this long after the score is confirmed (same as the database)
const RATING_WINDOW_MS = 3 * 86_400_000;
const GUEST_ID_PREFIX = "guest-";

/** How another player played compared to their profile level: -2 well below ... +2 well above */
export type RatingValue = -2 | -1 | 0 | 1 | 2;

export type PlayerRating = { playerId: string; rating: RatingValue };

/** Lowest to highest, the order the scale shows them in */
export const RATING_VALUES: RatingValue[] = [-2, -1, 0, 1, 2];

/** The host's guests take a seat but aren't on the app, so they can't be rated */
export function guestId(matchId: string, seat: number) {
  return `${GUEST_ID_PREFIX}${matchId}-${seat}`;
}

export function isGuest(player: Player) {
  return player.id.startsWith(GUEST_ID_PREFIX);
}

/** Last moment to rate: the score's deadline while it's pending, a few days after it's confirmed */
export function ratingClosesAt(score: MatchScore) {
  return score.confirmedAt
    ? new Date(score.confirmedAt.getTime() + RATING_WINDOW_MS)
    : score.expiresAt;
}

/** Players you can rate in a match: your partner and opponents who are on the app */
export function playersToRate(match: MatchDetails, myId: string) {
  const myTeam = teamOf(match, myId);
  return (match.seats ?? [])
    .map((player, index) => ({ player, team: index < 2 ? 1 : 2 }))
    .filter(
      (seat): seat is { player: Player; team: 1 | 2 } =>
        seat.player !== undefined && seat.player.id !== myId && !isGuest(seat.player),
    )
    .map(({ player, team }) => ({ player, isPartner: team === myTeam }));
}

/** Whether you can still rate this match: there's a live score and you haven't rated yet */
export function isRatingOpen(match: MatchDetails, myId: string, now = new Date()) {
  const { score } = match;
  if (!score || score.status === "expired") return false;
  if (teamOf(match, myId) === undefined) return false;
  if (match.ratedBy?.includes(myId)) return false;
  return now < ratingClosesAt(score);
}
