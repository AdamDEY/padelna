import { PressableFeedback } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { useTournamentLive } from "@/hooks/useTournaments";
import { entryById, entryName, groupTables, matchTitle, nextMatchOf, playersOf } from "@/lib/tournament-live";

const FACE_SIZE = 34;
const FACE_OVERLAP = 11;

type TournamentLiveCardProps = {
  tournamentId: string;
  myId?: string;
  onPress: () => void;
};

/** Home: a tournament I'm playing is live, with my next match (design "Home · tournament live"). */
export function TournamentLiveCard({ tournamentId, myId, onPress }: TournamentLiveCardProps) {
  const { t } = useTranslation();
  const tournament = useTournamentLive(tournamentId).data;
  if (!tournament || tournament.status !== "live") return null;

  const next = nextMatchOf(tournament);
  const mine = entryById(tournament, tournament.myEntryId);
  const side = next?.mySide ?? 1;
  const theirs = next ? entryById(tournament, side === 1 ? next.entry2Id : next.entry1Id) : undefined;
  const myRow = groupTables(tournament)
    .find((group) => group.label === mine?.groupLabel)
    ?.rows.find((row) => row.entry.id === mine?.id);

  const standing = myRow
    ? t("tournaments.live.homeStanding", { rank: t("tournaments.live.ordinal", { count: myRow.rank, ordinal: true }), group: mine?.groupLabel, points: myRow.points })
    : undefined;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[t("tournaments.live.liveName", { name: tournament.name }), next ? matchTitle(next) : t("tournaments.live.noNextTitle"), standing].filter(Boolean).join(", ")}
      className="gap-3.5 rounded-3xl bg-accent p-[18px]"
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="shrink flex-row items-center gap-[7px] rounded-[10px] bg-white/15 py-1 pe-2.5 ps-[9px]">
          <View className="size-2 rounded-full bg-danger" />
          <Text numberOfLines={1} className="shrink font-black text-[12px] uppercase tracking-[0.4px] text-white">
            {t("tournaments.live.liveName", { name: tournament.name })}
          </Text>
        </View>
        {next ? (
          <View className="rounded-[10px] bg-lime px-2.5 py-1">
            <Text className="font-bold text-[12px] text-on-lime">
              {next.submitted ? t("tournaments.live.matchState.sent") : t("tournaments.live.matchState.next")}
            </Text>
          </View>
        ) : null}
      </View>

      <View className="gap-0.5">
        <Text className="font-bold text-[13px] text-primary-tint-text">
          {next ? t("tournaments.live.yourNextMatch", { match: matchTitle(next) }) : t("tournaments.live.noNextTitle")}
        </Text>
        <Text numberOfLines={2} className="font-black text-[22px] tracking-[-0.3px] text-white">
          {next ? t("tournaments.live.versus", { name: entryName(theirs, tournament.myEntryId, myId) }) : t("tournaments.live.noNextText")}
        </Text>
      </View>

      <View className="flex-row items-center justify-between gap-3">
        <View className="shrink flex-row items-center gap-2.5">
          <View className="flex-row">
            {playersOf(mine).map((player, index) => (
              <View key={player.id} style={index > 0 ? { marginStart: -FACE_OVERLAP } : undefined}>
                <PlayerAvatar player={player} size={FACE_SIZE} ringClassName="border-accent" />
              </View>
            ))}
          </View>
          {standing ? <Text numberOfLines={1} className="shrink font-bold text-[13px] text-white">{standing}</Text> : null}
        </View>
        <View className="flex-row items-center gap-1">
          <Text className="font-bold text-[14px] text-white">{t("tournaments.live.open")}</Text>
          <Icon as={ChevronRight} size={18} color="accent-foreground" />
        </View>
      </View>
    </PressableFeedback>
  );
}
