import { cn, PressableFeedback } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { TournamentFormatIcon } from "@/components/tournament-format-icon";
import { formatMatchDateTime, formatMatchDay } from "@/lib/format-date";
import { entryUnit, hasFewSpots, isIndividual } from "@/lib/tournament";
import type { TournamentSummary } from "@/types/tournament";

const chipTones = {
  neutral: { bg: "bg-out-of-range", fg: "text-ink-2" },
  few: { bg: "bg-warning-soft", fg: "text-warning" },
  in: { bg: "bg-success-soft", fg: "text-success-soft-foreground" },
  live: { bg: "bg-danger-soft", fg: "text-danger-soft-foreground" },
} as const;

type TournamentCardProps = {
  tournament: TournamentSummary;
  onPress: () => void;
};

/** A tournament on Home and in the list (designs "Home · tournaments by format", "Tournaments · all"). */
export function TournamentCard({ tournament, onPress }: TournamentCardProps) {
  const { t } = useTranslation();
  const { format, startsAt, clubName, capacity, entriesCount, spotsLeft, myStatus } = tournament;

  const formatLine = [
    t(`tournaments.format.${format}`),
    t(isIndividual(tournament) ? "tournaments.entry.individual" : "tournaments.entry.pairs"),
  ].join(" · ");
  // A group stage lasts the whole day, so its card leaves the hour out
  const when = startsAt ? (format === "groups" ? formatMatchDay(startsAt) : formatMatchDateTime(startsAt)) : undefined;
  const details = [when, clubName].filter(Boolean).join(" · ");
  const unit = t(`tournaments.unit.${entryUnit(tournament)}`);
  const isLive = tournament.status === "live";
  const count = capacity !== undefined && !isLive ? `${entriesCount}/${capacity}` : String(entriesCount);

  const chip = isLive
    ? { label: t("tournaments.live.chip"), tone: chipTones.live }
    : myStatus
    ? { label: t(`tournaments.myStatus.${myStatus}`), tone: myStatus === "confirmed" ? chipTones.in : chipTones.neutral }
    : spotsLeft === undefined
      ? undefined
      : !tournament.registrationOpen
        ? { label: t("tournaments.closed"), tone: chipTones.neutral }
        : spotsLeft === 0
          ? { label: t("tournaments.full"), tone: chipTones.few }
          : { label: t("tournaments.left", { count: spotsLeft }), tone: hasFewSpots(spotsLeft) ? chipTones.few : chipTones.neutral };

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[tournament.name, formatLine, details, `${count} ${unit}`, chip?.label].filter(Boolean).join(", ")}
      className="flex-row items-center gap-3 rounded-[20px] border border-line bg-surface p-3"
    >
      <View
        className={cn(
          "size-12 items-center justify-center rounded-[14px]",
          format === "americano" ? "bg-primary-soft" : "bg-lime-soft",
        )}
      >
        <TournamentFormatIcon format={format} />
      </View>

      <View className="min-w-0 flex-1 gap-px">
        {/* Two lines: the French words don't fit on one beside the count */}
        <Text
          numberOfLines={2}
          className={cn(
            "font-bold text-[11px] uppercase tracking-[0.5px]",
            format === "americano" ? "text-primary-dark" : "text-muted",
          )}
        >
          {formatLine}
        </Text>
        <Text numberOfLines={1} className="font-black text-[15px] text-foreground">
          {tournament.name}
        </Text>
        <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
          {details}
        </Text>
      </View>

      <View className="shrink-0 items-end gap-1">
        <Text className="font-black text-[13px] text-foreground">{count}</Text>
        <Text className="font-semibold text-[11px] text-muted">{unit}</Text>
        {chip ? (
          <View className={cn("rounded-lg px-[7px] py-[3px]", chip.tone.bg)}>
            <Text className={cn("font-bold text-[11px]", chip.tone.fg)}>{chip.label}</Text>
          </View>
        ) : null}
      </View>
    </PressableFeedback>
  );
}
