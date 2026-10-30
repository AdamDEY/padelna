import type { PlayerSuggestion } from "@/types/player";
import type { FeedMatch, ResultPost, Team } from "@/types/post";

/** The host's guests have no profile, so they can't be friends or open a sheet */
export function isGuest(player: PlayerSuggestion) {
  return player.id.startsWith("guest-");
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** "Karim J." */
function shortName(player: PlayerSuggestion) {
  return player.lastName ? `${player.firstName} ${player.lastName.charAt(0)}.` : player.firstName;
}

export type FeedPost = {
  post: ResultPost;
  /** "You and Karim J. won", "Youssef played with Mehdi, Salma and Amira" */
  title: string;
  /** Extra meta, e.g. "all 4 are your friends" */
  note?: string;
  /** Players you could still connect with (not you, not friends, not guests) */
  canConnect: boolean;
  /** Your friends in the match, for the Friend tag */
  friendIds: Set<string>;
  /** Everyone on the app in the match except you, for the Connect sheet */
  players: PlayerSuggestion[];
};

/**
 * A feed card told from your side: the team you (or else a friend) played on comes
 * first. If that team won, the title says so; otherwise it names who they played with.
 */
export function toFeedPost(match: FeedMatch, myId: string, photoUri?: string): FeedPost {
  // You show as "You" in the score rows, like in the design
  const [s1, s2, s3, s4] = match.seats.map((player) =>
    player.id === myId ? { ...player, firstName: "You", lastName: "" } : player,
  );
  const teams: [PlayerSuggestion[], PlayerSuggestion[]] = [[s1, s2], [s3, s4]];
  const isMe = (player: PlayerSuggestion) => player.id === myId;
  const seats = [s1, s2, s3, s4];
  const isFriend = (player: PlayerSuggestion) => player.connection === "connected";

  const focal =
    seats.find(isMe) ?? seats.find(isFriend) ?? seats.find((p) => !isGuest(p)) ?? seats[0];
  const focalTeam = teams[0].includes(focal) ? 0 : 1;
  // The card's subject comes first: their team first, and them first within it
  const withFocalFirst = (team: Team): Team => (team[1] === focal ? [team[1], team[0]] : team);
  const ordered: [Team, Team] =
    focalTeam === 0
      ? [withFocalFirst([s1, s2]), [s3, s4]]
      : [withFocalFirst([s3, s4]), [s1, s2]];
  const sets = match.sets.map(([a, b]): [number, number] => (focalTeam === 0 ? [a, b] : [b, a]));
  const focalWon = sets.filter(([a, b]) => a > b).length > sets.length / 2;

  const partner = teams[focalTeam].find((player) => player !== focal)!;
  const others = seats.filter((player) => player !== focal);
  const focalName = isMe(focal) ? "You" : shortName(focal);
  const title = focalWon
    ? `${focalName} and ${isGuest(partner) ? "a guest" : shortName(partner)} won`
    : `${focalName} played with ${joinNames(others.map((player) => (isGuest(player) ? "a guest" : player.firstName)))}`;

  const onApp = seats.filter((player) => !isGuest(player) && !isMe(player));
  // In your own matches you know who's who, so only other people's matches get Friend tags
  const playedIn = match.seats.some(isMe);
  const friendIds = new Set(playedIn ? [] : onApp.filter(isFriend).map((player) => player.id));
  // Only said of other people's matches; in yours, the missing Connect button says enough
  const allFriends = onApp.length === 4 && onApp.every(isFriend);

  return {
    post: {
      id: match.id,
      postedAt: match.confirmedAt,
      playedAt: match.playedAt,
      clubName: match.clubName,
      courtName: match.courtName ?? "",
      kind: match.kind,
      levelMin: match.levelMin,
      levelMax: match.levelMax,
      teams: ordered,
      sets,
      confirmed: true,
      photoUri,
    },
    title,
    note: allFriends ? "all 4 are your friends" : undefined,
    canConnect: onApp.some((player) => !isFriend(player)),
    friendIds,
    players: onApp,
  };
}
