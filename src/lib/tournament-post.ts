import { t } from "i18next";

import { formatTimeAgo } from "@/lib/format-date";
import { placeText, recapOf, resultText, type TournamentRecap } from "@/lib/tournament-history";
import { facesOf } from "@/lib/tournament-live";
import type { Player } from "@/types/player";
import type { FeedTournamentPost } from "@/types/post";
import type { LiveEntry, LiveMatch, LiveTournament } from "@/types/tournament";

/**
 * The tournament as one of its players saw it: `myEntryId` and each match's `mySide` are the
 * server's, for whoever is signed in, so a post by someone else needs them set again.
 */
export function viewedBy(tournament: LiveTournament, playerId: string): LiveTournament | undefined {
  const entry = tournament.entries.find((candidate) => candidate.player1?.id === playerId || candidate.player2?.id === playerId);
  if (!entry) return undefined;

  const sideOf = (match: LiveMatch): 1 | 2 | undefined => {
    const one = match.side1Players ?? (match.entry1Id ? [match.entry1Id] : []);
    const two = match.side2Players ?? (match.entry2Id ? [match.entry2Id] : []);
    return one.includes(entry.id) ? 1 : two.includes(entry.id) ? 2 : undefined;
  };
  return { ...tournament, myEntryId: entry.id, matches: tournament.matches.map((match) => ({ ...match, mySide: sideOf(match) })) };
}

/** What a tournament result card shows (design "Community · tournament result posts"). */
export type TournamentPostCard = {
  format: "groups" | "americano";
  title: string;
  /** "La Marsa Padel · 2 h ago" */
  meta: string;
  /** "Champions" (groups) */
  headline: string;
  /** "Groups + knockout · 16 teams", "Americano · Individual · 7 rounds" */
  detail: string;
  /** Groups: the matches won – lost */
  chip?: string;
  /** Groups: the last match they played, and who was in it */
  match?: { label: string; rows: { name: string; values: string[]; isWinner: boolean }[] };
  /** Americano: "1st of 16 players" and the points behind it */
  place?: string;
  points?: number;
  /** How I did in the same tournament, when I played it too */
  viewerLine?: string;
  /** Whether I played it, so "See the tournament" opens my recap */
  viewerPlayed: boolean;
};

const finishTitles = {
  winner: "tournamentPost.title.winner",
  runnerUp: "tournamentPost.title.runnerUp",
  semis: "tournamentPost.title.semis",
  quarters: "tournamentPost.title.quarters",
  groups: "tournamentPost.title.groups",
} as const;

const headlines = {
  winner: "tournamentShare.image.champions",
  runnerUp: "tournamentShare.image.runnerUp",
  semis: "tournamentShare.image.semis",
  quarters: "tournamentShare.image.quarters",
  groups: "tournamentShare.image.groups",
} as const;

/** "You" for me, else the first name */
const nameFor = (player: Player, viewerId: string) => (player.id === viewerId ? t("common.you") : player.firstName);

/** The faces of an entry with the author first: "You · Amira" */
function entryNames(entry: LiveEntry, authorId: string, viewerId: string) {
  return [...facesOf(entry)]
    .sort((a, b) => Number(b.id === authorId) - Number(a.id === authorId))
    .map((player) => nameFor(player, viewerId))
    .join(" · ");
}

/** The card for a post, told from the author's side; undefined when the author isn't in the tournament. */
export function tournamentPostCard(
  tournament: LiveTournament,
  post: FeedTournamentPost,
  viewerId: string,
): TournamentPostCard | undefined {
  const asAuthor = viewedBy(tournament, post.author.id);
  if (!asAuthor || tournament.status !== "finished") return undefined;
  const recap = recapOf(asAuthor, post.author.id);

  const subjects = [post.author, post.partner].filter((player) => player !== undefined);
  const subject = subjects.map((player) => nameFor(player, viewerId)).join(t("feed.and"));
  // "Wael won" / "You and Amira won": French needs to know how many
  const count = subjects.length;
  const meta = [tournament.clubName, formatTimeAgo(post.postedAt)].filter(Boolean).join(" · ");

  const viewer = post.author.id === viewerId || post.partner?.id === viewerId ? undefined : viewedBy(tournament, viewerId);
  const viewerRecap: TournamentRecap | undefined = viewer ? recapOf(viewer, viewerId) : undefined;
  const base = { meta, viewerPlayed: tournament.entries.some((entry) => entry.player1?.id === viewerId || entry.player2?.id === viewerId) };

  if (recap.kind === "groups") {
    const last = recap.path[recap.path.length - 1];
    const myEntry = asAuthor.entries.find((entry) => entry.id === asAuthor.myEntryId);
    const sets = last ? [...last.score.sets, ...(last.score.superTiebreak ? [last.score.superTiebreak] : [])] : [];
    return {
      ...base,
      format: "groups",
      title: t(finishTitles[recap.finish], { names: subject, count, tournament: tournament.name }),
      headline: t(headlines[recap.finish]),
      detail: `${t("tournaments.format.groups")} · ${t("tournamentRecap.teamsCount", { count: tournament.entries.length })}`,
      chip: `${recap.matchesWon} – ${recap.matchesLost}`,
      match:
        last && myEntry
          ? {
              label: last.stage ? t(`tournamentRecap.stage.${last.stage}`) : t("tournamentRecap.groupRound", { group: last.match.groupLabel, round: last.match.round }),
              rows: [
                { name: entryNames(myEntry, post.author.id, viewerId), values: sets.map(([mine]) => String(mine)), isWinner: last.won },
                ...(last.opponent
                  ? [{ name: entryNames(last.opponent, post.author.id, viewerId), values: sets.map(([, theirs]) => String(theirs)), isWinner: !last.won }]
                  : []),
              ],
            }
          : undefined,
      viewerLine: viewerRecap ? t("tournamentPost.viewerFinish", { result: resultText(viewerRecap) }) : undefined,
    };
  }

  const isPairs = tournament.entryMode === "pairs";
  const rounds = new Set(tournament.matches.filter((match) => match.stage === "league").map((match) => match.round)).size;
  const kind = t(isPairs ? "tournamentHistory.kind.americanoPairs" : "tournamentHistory.kind.americanoIndividual");
  const place = recap.rank === undefined ? "–" : placeText(recap.rank);
  return {
    ...base,
    format: "americano",
    title: t("tournamentPost.title.americano", { names: subject, count, place, tournament: tournament.name }),
    headline: "",
    detail: [kind, tournament.rounds ?? rounds ? t("tournamentPost.rounds", { count: tournament.rounds ?? rounds }) : undefined].filter(Boolean).join(" · "),
    place: `${place} ${t(isPairs ? "tournamentRecap.placeOfPairs" : "tournamentRecap.placeOfPlayers", { count: recap.total })}`,
    points: recap.points,
    viewerLine:
      viewerRecap?.kind === "americano" && viewerRecap.rank !== undefined
        ? t("tournamentPost.viewerPlace", { place: placeText(viewerRecap.rank), points: viewerRecap.points })
        : undefined,
  };
}
