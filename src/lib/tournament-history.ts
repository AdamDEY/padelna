import { t } from "i18next";

import { i18n } from "@/i18n";

import {
  americanoMatches,
  americanoScoreText,
  leaderboard,
  scoreModeOf,
  shortName,
  sidesOf,
  type LeaderRow,
} from "@/lib/americano-live";
import {
  entryById,
  entryName,
  flipScore,
  groupTables,
  knockoutRounds,
  myMatches as myTournamentMatches,
  type Stage,
  type StandingRow,
} from "@/lib/tournament-live";
import type { Player } from "@/types/player";
import type { LiveEntry, LiveMatch, LiveTournament, TournamentScore, TournamentSummary } from "@/types/tournament";

/** How far I got in a group stage + knockout; "runnerUp" lost the final, "groups" never left the group */
export type Finish = "winner" | "runnerUp" | "semis" | "quarters" | "groups";

/** One of my matches that has a confirmed score */
/** The knockout rounds a recap names */
export type KnockoutStage = Exclude<Stage, "groups">;

export type PathStep = {
  match: LiveMatch;
  /** The knockout round this match belonged to; undefined for a group match */
  stage?: KnockoutStage;
  won: boolean;
  opponent?: LiveEntry;
  /** Written from my side */
  score: TournamentScore;
};

export type Podium = {
  first?: LiveEntry;
  second?: LiveEntry;
  third?: LiveEntry;
  /** The other semi-final loser, who shares third place */
  sharedThird?: LiveEntry;
};

export type GroupsRecap = {
  kind: "groups";
  finish: Finish;
  matchesWon: number;
  matchesLost: number;
  setsWon: number;
  setsLost: number;
  path: PathStep[];
  podium: Podium;
  /** The table of my group, and where I finished in it */
  group?: { label: string; rows: StandingRow[]; myRank?: number };
};

export type RoundStep = {
  match: LiveMatch;
  won: boolean;
  /** "Wael M.", or "Karim J." in pairs */
  partner: string;
  /** "Ines G. + Mehdi B." */
  opponents: string;
  /** "20-12", from my side */
  score: string;
  /** My points minus theirs, to find the best round */
  margin: number;
};

export type AmericanoRecap = {
  kind: "americano";
  rank?: number;
  /** Players (or pairs) in the tournament */
  total: number;
  points: number;
  roundsWon: number;
  roundsLost: number;
  rows: LeaderRow[];
  rounds: RoundStep[];
  best?: RoundStep;
};

export type TournamentRecap = GroupsRecap | AmericanoRecap;

/** [won, lost] sets from one side; a super tie-break counts as the deciding set */
function setsFor(score: TournamentScore, side: 1 | 2): [number, number] {
  const seen = side === 1 ? score : flipScore(score);
  let won = 0;
  let lost = 0;
  for (const [a, b] of seen.sets) {
    if (a > b) won++;
    else lost++;
  }
  if (seen.superTiebreak) {
    if (seen.superTiebreak[0] > seen.superTiebreak[1]) won++;
    else lost++;
  }
  return [won, lost];
}

function winnerAndLoser(tournament: LiveTournament, match: LiveMatch) {
  const winner = entryById(tournament, match.winnerEntryId);
  const loserId = match.entry1Id === match.winnerEntryId ? match.entry2Id : match.entry1Id;
  return { winner, loser: match.winnerEntryId ? entryById(tournament, loserId) : undefined };
}

function podiumOf(tournament: LiveTournament): Podium {
  const rounds = knockoutRounds(tournament);
  const final = rounds.find((round) => round.stage === "final")?.matches[0];
  const semis = rounds.find((round) => round.stage === "semis")?.matches ?? [];
  const { winner, loser } = final ? winnerAndLoser(tournament, final) : { winner: undefined, loser: undefined };
  const semiLosers = semis.map((match) => winnerAndLoser(tournament, match).loser).filter((entry) => entry !== undefined);
  // Third place is mine when I lost a semi-final, else the first loser
  const third = semiLosers.find((entry) => entry.id === tournament.myEntryId) ?? semiLosers[0];
  return {
    first: winner,
    second: loser,
    third,
    sharedThird: semiLosers.find((entry) => entry.id !== third?.id),
  };
}

function finishOf(tournament: LiveTournament): Finish {
  const me = tournament.myEntryId;
  const rounds = knockoutRounds(tournament);
  for (const round of [...rounds].reverse()) {
    const match = round.matches.find((candidate) => candidate.entry1Id === me || candidate.entry2Id === me);
    if (!match) continue;
    if (round.stage === "final") return match.winnerEntryId === me ? "winner" : "runnerUp";
    return round.stage === "semis" ? "semis" : "quarters";
  }
  return "groups";
}

const knockoutStageOf = (stage: Stage | undefined): KnockoutStage | undefined => (stage === "groups" ? undefined : stage);

function groupsRecap(tournament: LiveTournament): GroupsRecap {
  const me = tournament.myEntryId;
  const rounds = knockoutRounds(tournament);
  const path = myTournamentMatches(tournament).flatMap((match): PathStep[] => {
    if (!match.score || !match.winnerEntryId || !match.mySide) return [];
    const opponentId = match.mySide === 1 ? match.entry2Id : match.entry1Id;
    return [
      {
        match,
        stage: match.stage === "knockout" ? knockoutStageOf(rounds.find((round) => round.round === match.round)?.stage) : undefined,
        won: match.winnerEntryId === me,
        opponent: entryById(tournament, opponentId),
        score: match.mySide === 1 ? match.score : flipScore(match.score),
      },
    ];
  });

  let setsWon = 0;
  let setsLost = 0;
  for (const step of path) {
    const [won, lost] = setsFor(step.score, 1);
    setsWon += won;
    setsLost += lost;
  }

  const myGroup = tournament.entries.find((entry) => entry.id === me)?.groupLabel;
  const table = groupTables(tournament).find((group) => group.label === myGroup);

  return {
    kind: "groups",
    finish: finishOf(tournament),
    matchesWon: path.filter((step) => step.won).length,
    matchesLost: path.filter((step) => !step.won).length,
    setsWon,
    setsLost,
    path,
    podium: podiumOf(tournament),
    group: table ? { label: table.label, rows: table.rows, myRank: table.rows.find((row) => row.entry.id === me)?.rank } : undefined,
  };
}

/** Pairs Americano matches name the two pairs, not lists of players; give them sides like the individual ones */
function withSides(tournament: LiveTournament): LiveTournament {
  return {
    ...tournament,
    matches: tournament.matches.map((match) =>
      match.stage === "league" && !match.side1Players && match.entry1Id && match.entry2Id
        ? {
            ...match,
            side1Players: [match.entry1Id],
            side2Players: [match.entry2Id],
            winnerSide: match.winnerEntryId === match.entry1Id ? 1 : match.winnerEntryId === match.entry2Id ? 2 : undefined,
          }
        : match,
    ),
  };
}

/** Who I was with and against in one round, as names */
function roundLine(tournament: LiveTournament, match: LiveMatch, myId: string | undefined) {
  const [one, two] = sidesOf(match);
  const mine = match.mySide === 2 ? two : one;
  const theirs = match.mySide === 2 ? one : two;

  // Pairs: my entry is the pair, so my partner is the other player in it
  const mate = partnerOf(tournament, myId);
  if (mine.length === 1 && mate) {
    return {
      partner: `${mate.firstName} ${mate.lastName.charAt(0)}.`,
      opponents: theirs.map((id) => entryName(entryById(tournament, id))).join(" + "),
    };
  }
  return {
    partner: shortName(entryById(tournament, mine.find((id) => id !== tournament.myEntryId))),
    opponents: theirs.map((id) => shortName(entryById(tournament, id))).join(" + "),
  };
}

function americanoRecap(source: LiveTournament, myId: string | undefined): AmericanoRecap {
  const tournament = withSides(source);
  const mode = scoreModeOf(tournament);
  const rows = leaderboard(tournament);
  const mine = rows.find((row) => row.entry.id === tournament.myEntryId);

  const rounds = americanoMatches(tournament)
    .filter((match) => match.mySide !== undefined && match.score && match.winnerSide)
    .map((match): RoundStep => {
      const text = americanoScoreText(mode, match.score as TournamentScore, match.mySide);
      const [mineScore, theirScore] = text.split("-").map(Number);
      return {
        match,
        won: match.winnerSide === match.mySide,
        ...roundLine(tournament, match, myId),
        score: text,
        margin: mineScore - theirScore,
      };
    });

  return {
    kind: "americano",
    rank: mine?.rank,
    total: rows.length,
    points: mine?.scored ?? 0,
    roundsWon: rounds.filter((round) => round.won).length,
    roundsLost: rounds.filter((round) => !round.won).length,
    rows,
    rounds,
    // The biggest win; the earlier round when two tie
    best: rounds.filter((round) => round.won).reduce<RoundStep | undefined>((best, round) => (!best || round.margin > best.margin ? round : best), undefined),
  };
}

/** What I did in a finished tournament, whatever its format. */
export function recapOf(tournament: LiveTournament, myId: string | undefined): TournamentRecap {
  return tournament.format === "americano" ? americanoRecap(tournament, myId) : groupsRecap(tournament);
}

/** A tournament in the history: its summary, the live data it was read from and what I did in it */
export type HistoryItem = {
  summary: TournamentSummary;
  tournament: LiveTournament;
  recap: TournamentRecap;
  /** The player I played with, when it was in pairs */
  partner?: Player;
};

/** Whether this was a title: I won the final, or I came first in the Americano */
export function isTitle(recap: TournamentRecap) {
  return recap.kind === "groups" ? recap.finish === "winner" : recap.rank === 1;
}

/** Whether a recap is a podium finish in an Americano, or a win in groups: the lime "trophy" chips */
export function isPodium(recap: TournamentRecap) {
  return recap.kind === "groups" ? recap.finish === "winner" : recap.rank !== undefined && recap.rank <= 3;
}

/** Totals for the blue header of the history */
export function summarizeHistory(items: HistoryItem[]) {
  let won = 0;
  let lost = 0;
  let bestAmericano: number | undefined;
  for (const { recap } of items) {
    if (recap.kind === "groups") {
      won += recap.matchesWon;
      lost += recap.matchesLost;
    } else {
      won += recap.roundsWon;
      lost += recap.roundsLost;
      if (recap.rank !== undefined) bestAmericano = Math.min(bestAmericano ?? Infinity, recap.rank);
    }
  }
  const titles = items.filter((item) => isTitle(item.recap));
  return { played: items.length, titles, won, lost, bestAmericano };
}

/** My partner in a pair entry, or undefined when I played alone (or the pair was typed by name) */
export function partnerOf(tournament: LiveTournament, myId: string | undefined): Player | undefined {
  const me = entryById(tournament, tournament.myEntryId);
  if (!me?.player2) return undefined;
  return [me.player1, me.player2].find((player) => player !== undefined && player.id !== myId);
}

/** "3rd", "1er": the plural rules of the phone's JS engine don't do ordinals, so the endings are chosen here */
export function placeText(rank: number) {
  const english = i18n.language !== "fr";
  const last = rank % 10;
  const teen = rank % 100 >= 11 && rank % 100 <= 13;
  const form = !english ? (rank === 1 ? "one" : "other") : teen ? "other" : last === 1 ? "one" : last === 2 ? "two" : last === 3 ? "few" : "other";
  return t(`tournamentHistory.ordinal.${form}`, { count: rank });
}

/** "Winner", "Quarter-final", "3rd of 16": the short line a tournament ends with */
export function resultText(recap: TournamentRecap) {
  if (isTitle(recap)) return t("tournamentHistory.finish.winner");
  if (recap.kind === "groups") return t(`tournamentHistory.finish.${recap.finish}`);
  return recap.rank === undefined ? "–" : t("tournamentHistory.placeOf", { place: placeText(recap.rank), total: recap.total });
}
