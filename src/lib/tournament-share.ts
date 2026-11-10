import { t } from "i18next";

import { formatMatchDay } from "@/lib/format-date";
import { isIndividual } from "@/lib/tournament";
import { isPodium, isTitle, placeText, type TournamentRecap } from "@/lib/tournament-history";
import { facesOf } from "@/lib/tournament-live";
import type { Player } from "@/types/player";
import type { LiveEntry, LiveTournament } from "@/types/tournament";

/** A line of the white card on the result image: who, and their numbers */
export type ShareRow = {
  faces: Player[];
  name: string;
  /** One box each: the games of each set, or the points */
  values: string[];
  /** The winner of the match, or me in the leaderboard: lime boxes */
  isHighlighted: boolean;
};

/** Everything the result image shows (design "Tournament · result image for chats and stories"). */
export type ShareResult = {
  /** Format chip, top right */
  badge: string;
  headline: string;
  name: string;
  details: string;
  cardLabel: string;
  rows: ShareRow[];
  stats: { value: string; label: string }[];
};

/** "Youssef + Amira", the first names of a pair, for the picture */
function firstNames(entry: LiveEntry) {
  return facesOf(entry)
    .map((player) => player.firstName)
    .join(" + ");
}

function groupsResult(tournament: LiveTournament, recap: Extract<TournamentRecap, { kind: "groups" }>): ShareResult {
  const me = tournament.entries.find((entry) => entry.id === tournament.myEntryId);
  // The last match I played: the final for a champion, the one I went out in for everyone else
  const last = recap.path[recap.path.length - 1];
  const label = last
    ? last.stage
      ? t(`tournamentRecap.stage.${last.stage}`)
      : t("tournamentRecap.groupRound", { group: last.match.groupLabel, round: last.match.round })
    : "";
  const sets = last ? [...last.score.sets, ...(last.score.superTiebreak ? [last.score.superTiebreak] : [])] : [];

  return {
    badge: t("tournaments.format.groups"),
    headline: t(`tournamentShare.image.${recap.finish === "winner" ? "champions" : recap.finish}`),
    name: tournament.name,
    details: detailsOf(tournament, t("tournamentRecap.teamsCount", { count: tournament.entries.length })),
    cardLabel: label,
    rows:
      last && me
        ? [
            { faces: facesOf(me), name: firstNames(me), values: sets.map(([mine]) => String(mine)), isHighlighted: last.won },
            ...(last.opponent
              ? [{ faces: facesOf(last.opponent), name: firstNames(last.opponent), values: sets.map(([, theirs]) => String(theirs)), isHighlighted: !last.won }]
              : []),
          ]
        : [],
    stats: [
      { value: String(recap.matchesWon + recap.matchesLost), label: t("tournamentShare.image.matches") },
      { value: `${recap.matchesWon} – ${recap.matchesLost}`, label: t("tournamentShare.image.won") },
      { value: `${recap.setsWon} – ${recap.setsLost}`, label: t("tournamentShare.image.sets") },
    ],
  };
}

function americanoResult(tournament: LiveTournament, recap: Extract<TournamentRecap, { kind: "americano" }>): ShareResult {
  const isPairs = !isIndividual({ format: tournament.format, entryMode: tournament.entryMode });
  const podium = recap.rows.slice(0, 3);
  const mine = recap.rows.find((row) => row.entry.id === tournament.myEntryId);
  const shown = mine && !podium.includes(mine) ? [...podium, mine] : podium;

  return {
    badge: t(isPairs ? "tournamentHistory.kind.americanoPairs" : "tournamentHistory.kind.americanoIndividual"),
    headline: isTitle(recap)
      ? t("tournamentShare.image.champion")
      : isPodium(recap)
        ? t("tournamentShare.image.podium")
        : recap.rank !== undefined
          ? t("tournamentHistory.placeOf", { place: placeText(recap.rank), total: recap.total })
          : "–",
    name: tournament.name,
    details: detailsOf(tournament, t(isPairs ? "tournamentRecap.pairsCount" : "tournamentRecap.playersCount", { count: recap.total })),
    cardLabel: t("tournamentShare.image.topThree"),
    rows: shown.map((row) => ({
      faces: facesOf(row.entry),
      name: row.entry.id === tournament.myEntryId ? t("tournamentShare.image.you") : firstNames(row.entry),
      values: [String(row.scored)],
      isHighlighted: row.entry.id === tournament.myEntryId,
    })),
    stats: [
      { value: String(recap.points), label: t("tournamentShare.image.points") },
      { value: String(recap.roundsWon + recap.roundsLost), label: t("tournamentShare.image.rounds") },
      { value: `${recap.roundsWon} – ${recap.roundsLost}`, label: t("tournamentShare.image.won") },
    ],
  };
}

function detailsOf(tournament: LiveTournament, count: string) {
  return [tournament.startsAt ? formatMatchDay(tournament.startsAt) : undefined, tournament.clubName, count].filter(Boolean).join(" · ");
}

export function shareResultOf(tournament: LiveTournament, recap: TournamentRecap): ShareResult {
  return recap.kind === "groups" ? groupsResult(tournament, recap) : americanoResult(tournament, recap);
}
