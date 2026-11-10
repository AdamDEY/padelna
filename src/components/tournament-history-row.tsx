import { cn, PressableFeedback } from "heroui-native";
import { Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar } from "@/components/player-avatar";
import { TournamentFormatIcon } from "@/components/tournament-format-icon";
import { formatMatchDay } from "@/lib/format-date";
import { isIndividual } from "@/lib/tournament";
import { isPodium, isTitle, resultText, type HistoryItem } from "@/lib/tournament-history";

type TournamentHistoryRowProps = {
  item: HistoryItem;
  onPress: () => void;
};

/** One finished tournament in Tournament history: what it was, where and when, and how it ended (design "Tournament history"). */
export function TournamentHistoryRow({ item, onPress }: TournamentHistoryRowProps) {
  const { t } = useTranslation();
  const { summary, recap, partner } = item;
  const { format } = summary;

  const kind = t(
    format === "groups"
      ? "tournamentHistory.kind.groups"
      : isIndividual(summary)
        ? "tournamentHistory.kind.americanoIndividual"
        : "tournamentHistory.kind.americanoPairs",
  );
  const when = [summary.startsAt ? formatMatchDay(summary.startsAt) : undefined, summary.clubName].filter(Boolean).join(" · ");
  const result = resultText(recap);
  const withLine = partner
    ? t("tournamentHistory.withPartner", { name: `${partner.firstName} ${partner.lastName.charAt(0)}.` })
    : isIndividual(summary)
      ? t("tournamentHistory.individualRotated")
      : undefined;

  // Winner on dark, the rest of the podium on lime, a runner-up final on lime, everything else quiet
  const chip = isTitle(recap)
    ? { box: "bg-ink", text: "text-lime", icon: "lime" }
    : isPodium(recap) || (recap.kind === "groups" && recap.finish === "runnerUp")
      ? { box: "bg-lime-soft", text: "text-lime-foreground", icon: "lime-foreground" }
      : recap.kind === "groups"
        ? { box: "bg-primary-soft", text: "text-primary-dark", icon: undefined }
        : { box: "bg-out-of-range", text: "text-ink-2", icon: undefined };
  const hasTrophy = chip.icon !== undefined;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("tournamentHistory.a11yRow", { name: summary.name, kind, when, result })}
    >
      <View className="flex-row items-start gap-3 rounded-[18px] border border-line bg-surface p-3">
        <View
          className={cn(
            "size-11 items-center justify-center rounded-[14px]",
            format === "americano" ? "bg-primary-soft" : "bg-lime-soft",
          )}
        >
          <TournamentFormatIcon format={format} size={22} />
        </View>

        <View className="min-w-0 flex-1 gap-[3px]">
          <Text
            numberOfLines={1}
            className={cn(
              "font-bold text-[11px] uppercase tracking-[0.5px]",
              format === "americano" ? "text-primary-dark" : "text-muted",
            )}
          >
            {kind}
          </Text>
          <Text numberOfLines={2} className="font-black text-[16px] text-foreground">
            {summary.name}
          </Text>
          {when ? (
            <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
              {when}
            </Text>
          ) : null}
          {withLine ? (
            <View className="flex-row items-center gap-1.5">
              {partner ? <PlayerAvatar player={partner} size={22} /> : null}
              <Text numberOfLines={1} className="flex-1 font-normal text-[12px] text-ink-2">
                {withLine}
              </Text>
            </View>
          ) : null}
        </View>

        <View className={cn("shrink-0 flex-row items-center gap-1 self-start rounded-[10px] px-[9px] py-1", chip.box)}>
          {hasTrophy ? <Icon as={Trophy} size={13} color={chip.icon} /> : null}
          <Text className={cn("font-black text-[12px]", chip.text)}>{result}</Text>
        </View>
      </View>
    </PressableFeedback>
  );
}
