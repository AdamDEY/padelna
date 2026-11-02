import { cn, PressableFeedback } from "heroui-native";
import { t } from "i18next";
import { Text, View } from "react-native";

import { PlayerAvatar } from "@/components/player-avatar";
import { formatMatchDay } from "@/lib/format-date";
import { namesOf, shownResult } from "@/lib/match-history";
import type { PastMatch } from "@/types/match";

const badgeTones = {
  won: { box: "bg-lime-soft", text: "text-lime-foreground", label: "result.badgeWon" },
  lost: { box: "bg-attention-soft", text: "text-attention", label: "result.badgeLost" },
} as const;

type MatchHistoryRowProps = {
  match: PastMatch;
  onPress: () => void;
};

/**
 * One finished match in Match history (design canvas "Match history v2"): a W / L letter,
 * the set scores, who you played with and against, and where and when.
 */
export function MatchHistoryRow({ match, onPress }: MatchHistoryRowProps) {
  const result = shownResult(match);
  const tone = result ? badgeTones[result] : undefined;
  const score = match.sets.map(([mine, theirs]) => `${mine}–${theirs}`).join(" · ");
  const title = match.result === "none" ? t("history.scoreNotSaved") : score;
  const withLine = [
    match.partner ? t("history.withPartner", { name: match.partner.firstName }) : null,
    match.opponents.length > 0 ? t("history.versus", { names: namesOf(match.opponents) }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const where = [formatMatchDay(match.playedAt), match.clubName].join(" · ");
  const tag =
    match.result === "none"
      ? { text: t("history.addScore"), box: "bg-warning-soft", color: "text-warning" }
      : match.result === "unconfirmed"
        ? { text: t("history.pending"), box: "bg-primary-soft", color: "text-primary-dark" }
        : undefined;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, withLine, where, tag?.text].filter(Boolean).join(", ")}
    >
      <View className="flex-row items-center gap-3 rounded-[18px] border border-line bg-surface p-3">
        <View
          className={cn("size-10 items-center justify-center rounded-xl", tone?.box ?? "bg-out-of-range")}
        >
          <Text className={cn("font-black text-[16px]", tone?.text ?? "text-muted")}>
            {tone ? t(tone.label) : "–"}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-black text-[16px] text-foreground">
            {title}
          </Text>
          {withLine ? (
            <View className="flex-row items-center gap-1.5">
              {match.partner ? <PlayerAvatar player={match.partner} size={18} /> : null}
              <Text numberOfLines={1} className="flex-1 font-normal text-[12px] text-ink-2">
                {withLine}
              </Text>
            </View>
          ) : null}
          <Text numberOfLines={1} className="font-normal text-[12px] text-muted">
            {where}
          </Text>
        </View>
        {tag ? (
          <Text className={cn("overflow-hidden rounded-[10px] px-2 py-1 font-bold text-[11px]", tag.box, tag.color)}>
            {tag.text}
          </Text>
        ) : null}
      </View>
    </PressableFeedback>
  );
}
