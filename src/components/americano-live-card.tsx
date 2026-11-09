import { PressableFeedback } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { faceOf } from "@/components/americano-score-sheet";
import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { useTournamentLive } from "@/hooks/useTournaments";
import { currentRound, leaderboard, lineUp, myMatchIn, roundCount, shortName } from "@/lib/americano-live";

const FACE_SIZE = 34;
const FACE_OVERLAP = 11;

type AmericanoLiveCardProps = {
  tournamentId: string;
  onPress: () => void;
};

/** Home: an individual Americano I'm playing is live, with my match this round. */
export function AmericanoLiveCard({ tournamentId, onPress }: AmericanoLiveCardProps) {
  const { t } = useTranslation();
  const tournament = useTournamentLive(tournamentId).data;
  if (!tournament || tournament.status !== "live") return null;

  const round = currentRound(tournament);
  const match = myMatchIn(tournament, round);
  const lineup = match ? lineUp(tournament, match) : undefined;
  const me = tournament.entries.find((entry) => entry.id === tournament.myEntryId);
  const myRow = leaderboard(tournament).find((row) => row.entry.id === tournament.myEntryId);
  const standing = myRow
    ? t("tournaments.americano.homeStanding", { rank: t("tournaments.live.ordinal", { count: myRow.rank, ordinal: true }), points: myRow.scored })
    : undefined;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[t("tournaments.live.liveName", { name: tournament.name }), t("tournaments.americano.roundOf", { round, total: roundCount(tournament) }), standing].filter(Boolean).join(", ")}
      className="gap-3.5 rounded-3xl bg-accent p-[18px]"
    >
      <View className="flex-row items-center justify-between gap-2">
        <View className="shrink flex-row items-center gap-[7px] rounded-[10px] bg-white/15 py-1 pe-2.5 ps-[9px]">
          <View className="size-2 rounded-full bg-danger" />
          <Text numberOfLines={1} className="shrink font-black text-[12px] uppercase tracking-[0.4px] text-white">
            {t("tournaments.live.liveName", { name: tournament.name })}
          </Text>
        </View>
        <View className="rounded-[10px] bg-lime px-2.5 py-1">
          <Text className="font-bold text-[12px] text-lime-foreground">{t("tournaments.americano.roundOf", { round, total: roundCount(tournament) })}</Text>
        </View>
      </View>

      {lineup ? (
        <View className="gap-0.5">
          <Text className="font-bold text-[13px] text-primary-tint-text">
            {t("tournaments.americano.withPartner", { name: shortName(lineup.partner) })}
          </Text>
          <Text numberOfLines={2} className="font-black text-[22px] tracking-[-0.3px] text-white">
            {t("tournaments.americano.versus", { names: lineup.opponents.map(shortName).join(" + ") })}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between gap-3">
        <View className="shrink flex-row items-center gap-2.5">
          <View className="flex-row">
            {[me, lineup?.partner].filter((entry) => entry !== undefined).map((entry, index) => (
              <View key={entry.id} style={index > 0 ? { marginStart: -FACE_OVERLAP } : undefined}>
                <PlayerAvatar player={faceOf(entry)} size={FACE_SIZE} ringClassName="border-accent" />
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
