import { ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { formatDayMonth } from "@/lib/format-date";
import { formatTeamLevel } from "@/lib/tournament";
import type { Player } from "@/types/player";
import type { TournamentTeam } from "@/types/tournament";

// Pair of faces, the second overlapping the first (design "Tournament detail")
const AVATAR_SIZE = 36;
const AVATAR_OVERLAP = 12;

/** A pair typed by name before player accounts: only the initials are known. */
function namedPlayer(teamId: string, name: string): Player {
  const [firstName, ...rest] = name.split(" ");
  return { id: `${teamId}:${name}`, firstName, lastName: rest.join(" ") };
}

type TournamentTeamRowProps = {
  team: TournamentTeam;
  /** The signed-in player's own pair */
  isMine?: boolean;
};

/** One pair in "Who joined": faces, names, coach badge, friends or the date they joined, team level. */
export function TournamentTeamRow({ team, isMine = false }: TournamentTeamRowProps) {
  const { t } = useTranslation();
  const players = [team.player1, team.player2].filter((player) => player !== undefined);
  const friends = players.filter((player) => player.isFriend);
  const hasCoachVerified = players.some((player) => player.coachVerified);

  const faces: Player[] =
    players.length > 0
      ? players
      : [team.name1, team.name2].filter((name) => name !== undefined).map((name) => namedPlayer(team.id, name));
  const names =
    players.length > 0
      ? players.map(shortNameOf).join(" + ")
      : [team.name1, team.name2].filter(Boolean).join(" + ");

  const social =
    team.status === "invited"
      ? t("tournaments.team.waiting")
      : isMine
        ? t("tournaments.team.yourTeam")
        : friends.length === 2
          ? t("tournaments.team.yourFriends")
          : friends.length === 1
            ? t("tournaments.team.yourFriend", { name: friends[0].firstName })
            : // A pair typed by name has no real join date: the row only says when it was migrated
              hasCoachVerified || players.length === 0
              ? undefined
              : t("tournaments.team.joined", { date: formatDayMonth(team.joinedAt) });

  return (
    <View className="flex-row items-center gap-3 border-t border-fill py-2.5">
      <View className="flex-row">
        {faces.map((player, index) => (
          <View key={player.id} style={index > 0 ? { marginStart: -AVATAR_OVERLAP } : undefined}>
            <PlayerAvatar player={player} size={AVATAR_SIZE} ringClassName="border-surface" />
          </View>
        ))}
      </View>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="font-bold text-[15px] text-foreground">
          {names}
        </Text>
        <View className="flex-row items-center gap-1">
          {hasCoachVerified ? (
            <View className="flex-row items-center gap-[3px]">
              <Icon as={ShieldCheck} size={12} color="success-soft-foreground" />
              <Text className="font-bold text-[12px] text-success-soft-foreground">{t("tournaments.team.coachVerified")}</Text>
            </View>
          ) : null}
          {hasCoachVerified && social ? <Text className="font-normal text-[12px] text-muted">·</Text> : null}
          {social ? (
            <Text numberOfLines={1} className="shrink font-normal text-[12px] text-muted">
              {social}
            </Text>
          ) : null}
        </View>
      </View>

      {team.teamLevel !== undefined ? (
        <View className="rounded-[10px] bg-lime-soft px-2.5 py-1">
          <Text className="font-bold text-[12px] text-lime-foreground">{formatTeamLevel(team.teamLevel)}</Text>
        </View>
      ) : null}
    </View>
  );
}
