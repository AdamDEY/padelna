import { Button, cn } from "heroui-native";
import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import type { summarize } from "@/lib/match-history";

type MatchHistoryHeroProps = {
  /** "32 matches since May"; left out until there is a match */
  subtitle?: string;
  summary?: ReturnType<typeof summarize>;
  onBack: () => void;
};

/** Blue header of Match history: the totals and your last ten results (design canvas "Match history v2"). */
export function MatchHistoryHero({ subtitle, summary, onBack }: MatchHistoryHeroProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const streak = summary?.streak
    ? t(summary.streak.result === "won" ? "profile.streakWin" : "profile.streakLoss", { count: summary.streak.count })
    : "–";
  const stats = summary
    ? [
        { value: `${summary.won} – ${summary.lost}`, label: t("history.wonLost") },
        { value: summary.winRate !== undefined ? `${summary.winRate}%` : "–", label: t("history.winRate") },
        { value: streak, label: t("history.streak") },
      ]
    : [];

  return (
    <View
      className="gap-4 overflow-hidden rounded-b-[32px] bg-hero px-5 pb-5"
      style={{ paddingTop: insets.top + 8 }}
    >
      {/* Faint court lines in the corner */}
      <View
        aria-hidden
        className="absolute -end-[60px] h-[170px] w-[220px] rounded-lg border-2 border-white/10"
        style={{ top: insets.top + 30 }}
      />

      <View className="flex-row items-center gap-3">
        <Button
          variant="ghost"
          isIconOnly
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          className="size-11 rounded-full bg-white/15"
        >
          <Icon as={ChevronLeft} size={22} color="accent-foreground" />
        </Button>
        <View className="flex-1">
          <Text
            accessibilityRole="header"
            className="font-black text-[22px] tracking-[-0.3px] text-accent-foreground"
          >
            {t("history.title")}
          </Text>
          {subtitle ? (
            <Text className="font-normal text-[13px] text-primary-tint-text">{subtitle}</Text>
          ) : null}
        </View>
      </View>

      {summary ? (
        <>
          <View className="flex-row rounded-[18px] bg-white/12 py-3">
            {stats.map((stat, index) => (
              <View
                key={stat.label}
                accessible
                accessibilityLabel={`${stat.value} ${stat.label}`}
                className={cn("flex-1 items-center", index > 0 && "border-s border-white/20")}
              >
                <Text className="font-black text-[20px] text-accent-foreground">{stat.value}</Text>
                <Text className="font-normal text-[11px] text-primary-tint-text">{stat.label}</Text>
              </View>
            ))}
          </View>

          {summary.lastTen.length > 0 ? (
            <View className="flex-row items-center justify-between">
              <Text className="font-bold text-[12px] text-primary-tint-text">{t("history.lastTen")}</Text>
              <View className="flex-row gap-[5px]">
                {summary.lastTen.map((result, index) => (
                  <View
                    key={index}
                    className={cn(
                      "size-[22px] items-center justify-center rounded-[7px]",
                      result === "won" ? "bg-lime" : "bg-white/18",
                    )}
                  >
                    <Text
                      className={cn(
                        "font-black text-[11px]",
                        result === "won" ? "text-on-lime" : "text-accent-foreground",
                      )}
                    >
                      {t(result === "won" ? "result.badgeWon" : "result.badgeLost")}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
