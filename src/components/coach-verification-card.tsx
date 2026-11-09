import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { CoachVerifiedBadge } from "@/components/coach-verified-badge";
import { COACH_MAX_SCORE, groupAverages } from "@/data/coach-skills";
import { formatFullDate } from "@/lib/format-date";
import type { CoachVerification } from "@/types/coach";

type CoachVerificationCardProps = {
  coach: CoachVerification;
};

/** Summary of a coach's evaluation: who, when, the level they set and a score per skill group. */
export function CoachVerificationCard({ coach }: CoachVerificationCardProps) {
  const { t } = useTranslation();
  const groups = groupAverages(coach.scores);

  return (
    <View className="gap-3.5 rounded-[22px] border border-line bg-surface p-4">
      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-1.5">
            <CoachVerifiedBadge />
            <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
              {t("coach.title")}
            </Text>
          </View>
          <Text className="font-normal text-[13px] text-muted">
            {t("coach.byOn", { coach: coach.coachName, date: formatFullDate(coach.evaluatedAt) })}
          </Text>
        </View>
        <View className="items-center rounded-2xl bg-success-soft px-3.5 py-1.5">
          <Text className="font-black text-[22px] leading-[26px] text-success-soft-foreground">
            {coach.level.toFixed(1)}
          </Text>
          <Text className="font-bold text-[11px] text-success-soft-foreground">{t("profile.levelWord")}</Text>
        </View>
      </View>

      {groups.length > 0 ? (
        <View className="gap-2.5">
          <Text className="font-bold text-[13px] text-muted">{t("coach.skills")}</Text>
          {groups.map(({ id, average }) => (
            <View
              key={id}
              accessible
              accessibilityLabel={t("coach.scoreA11y", {
                group: t(`coach.groups.${id}`),
                score: average.toFixed(1),
              })}
              className="flex-row items-center gap-3"
            >
              <Text numberOfLines={1} className="w-[128px] font-bold text-[14px] text-foreground">
                {t(`coach.groups.${id}`)}
              </Text>
              <View className="h-2 flex-1 overflow-hidden rounded-full bg-track">
                <View
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${(average / COACH_MAX_SCORE) * 100}%` }}
                />
              </View>
              <Text className="w-[26px] text-end font-black text-[14px] text-foreground">
                {average.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {coach.comment ? (
        <View className="gap-1 rounded-2xl bg-background px-3.5 py-3">
          <Text className="font-bold text-[12px] text-muted">{t("coach.note")}</Text>
          <Text className="font-normal text-[14px] leading-[20px] text-foreground">{coach.comment}</Text>
        </View>
      ) : null}
    </View>
  );
}
