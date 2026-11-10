import { PressableFeedback } from "heroui-native";
import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { TournamentFormatIcon } from "@/components/tournament-format-icon";
import { useTournament } from "@/hooks/useTournaments";
import { formatMatchDay } from "@/lib/format-date";
import { entryUnit } from "@/lib/tournament";
import type { TournamentSummary } from "@/types/tournament";

type TournamentUpcomingCardProps = {
  tournament: TournamentSummary;
  onPress: () => void;
};

/** The tournament I'm registered in that hasn't finished, pinned above the history (design "Tournament history"). */
export function TournamentUpcomingCard({ tournament, onPress }: TournamentUpcomingCardProps) {
  const { t } = useTranslation();
  // The list doesn't say who my partner is; the detail does
  const partner = useTournament(tournament.id).data?.myEntry?.partner;

  const eyebrow =
    tournament.status === "live"
      ? t("tournamentHistory.liveNow")
      : tournament.startsAt
        ? t("tournamentHistory.upcoming", { date: formatMatchDay(tournament.startsAt) })
        : t("tournaments.myStatus.confirmed");
  const unit = t(`tournaments.unit.${entryUnit(tournament)}`);
  const entries = tournament.capacity !== undefined ? `${tournament.entriesCount}/${tournament.capacity}` : String(tournament.entriesCount);
  const details = partner
    ? t("tournamentHistory.registeredWith", { name: `${partner.firstName} ${partner.lastName.charAt(0)}.`, entries, unit })
    : t("tournamentHistory.registered", { entries, unit });

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[eyebrow, tournament.name, details].join(", ")}
    >
      <View className="flex-row items-center gap-3 rounded-[18px] border-2 border-primary bg-surface p-3">
        <View className="size-11 items-center justify-center rounded-[14px] bg-lime-soft">
          <TournamentFormatIcon format={tournament.format} size={22} />
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-bold text-[11px] uppercase tracking-[0.5px] text-primary">
            {eyebrow}
          </Text>
          <Text numberOfLines={1} className="font-black text-[16px] text-foreground">
            {tournament.name}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {details}
          </Text>
        </View>
        <Icon as={ChevronRight} size={20} color="muted" />
      </View>
    </PressableFeedback>
  );
}
