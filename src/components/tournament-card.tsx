import { Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { formatMatchDateTime } from "@/lib/format-date";
import type { UpcomingTournament } from "@/types/tournament";

type TournamentCardProps = {
  tournament: UpcomingTournament;
  /** Fixed width inside a carousel; leave out to fill the row */
  width?: number;
};

/** Home: a tournament is open for entries. Display only for now; it doesn't open anything. */
export function TournamentCard({ tournament, width }: TournamentCardProps) {
  const { t } = useTranslation();
  const when = tournament.startsAt ? formatMatchDateTime(tournament.startsAt) : undefined;
  const details = [t(`home.tournament.category.${tournament.category}`), when, tournament.clubName]
    .filter(Boolean)
    .join(" · ");

  return (
    <View
      accessible
      accessibilityLabel={t("home.tournament.a11y", { name: tournament.name, details })}
      className="flex-row items-center gap-3.5 rounded-3xl border border-line bg-surface p-4"
      style={width ? { width } : undefined}
    >
      <View className="size-12 items-center justify-center rounded-full bg-lime-soft">
        <Icon as={Trophy} size={24} color="lime-foreground" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-bold text-[12px] uppercase tracking-[0.8px] text-muted">
          {t("home.tournament.title")}
        </Text>
        <Text className="font-black text-[17px] text-foreground" numberOfLines={2}>
          {tournament.name}
        </Text>
        <Text className="font-medium text-[14px] text-ink-2" numberOfLines={2}>
          {details}
        </Text>
      </View>
    </View>
  );
}
