import { router } from "expo-router";
import { cn, PressableFeedback } from "heroui-native";
import { Check, ChevronRight, Lock } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { STATS_MIN_MATCHES } from "@/lib/profile-stats";

// Friends to connect with for the "Connect" step
const FRIENDS_GOAL = 3;
const CHART_HEIGHT = 96;

/** White rounded section card, inset 16 px from the screen edges like the rest of Profile */
function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <View className={cn("mx-4 gap-3 rounded-[22px] border border-line bg-surface p-4", className)}>
      {children}
    </View>
  );
}

type StepProps = {
  title: string;
  hint: string;
  done?: boolean;
  onPress?: () => void;
  last?: boolean;
};

function Step({ title, hint, done, onPress, last }: StepProps) {
  const content = (
    <>
      <View
        className={cn(
          "size-7 items-center justify-center rounded-full",
          done ? "bg-success-soft" : "border-2 border-primary-outline",
        )}
      >
        {done ? <Icon as={Check} size={15} color="success" /> : null}
      </View>
      <View className="flex-1">
        <Text
          className={cn(
            "font-bold text-[15px]",
            done ? "text-muted-icon line-through" : "text-foreground",
          )}
        >
          {title}
        </Text>
        <Text className="font-normal text-[12px] text-muted">{hint}</Text>
      </View>
      {onPress && !done ? <Icon as={ChevronRight} size={18} color="muted-icon" /> : null}
    </>
  );
  const row = cn("flex-row items-center gap-3 py-[11px]", !last && "border-b border-fill");

  return onPress && !done ? (
    <PressableFeedback accessibilityRole="button" accessibilityLabel={`${title}. ${hint}`} onPress={onPress} className={row}>
      {content}
    </PressableFeedback>
  ) : (
    <View accessible accessibilityLabel={`${title}. ${hint}`} className={row}>
      {content}
    </View>
  );
}

type NewPlayerCardsProps = {
  friendCount: number;
  levelLabel: string;
};

/**
 * Profile body for a player with no matches yet (design canvas "Profile · new player"):
 * a getting-started checklist and quiet placeholders for what the first matches unlock.
 */
export function NewPlayerCards({ friendCount, levelLabel }: NewPlayerCardsProps) {
  const { t } = useTranslation();
  const [accent, dash, surface] = useCSSVariable([
    "--color-accent",
    "--color-out-of-range",
    "--color-surface",
  ]) as string[];

  // Profile setup is done by the time you see this screen; reviews don't exist in the backend yet
  const steps = [
    { title: t("profile.stepProfile"), hint: t("profile.stepProfileHint"), done: true },
    {
      title: t("profile.stepMatch"),
      hint: t("profile.stepMatchHint"),
      done: false,
      onPress: () => router.push("/matches"),
    },
    {
      title: t("profile.stepConnect", { count: FRIENDS_GOAL }),
      hint: t("profile.stepConnectHint"),
      done: friendCount >= FRIENDS_GOAL,
      onPress: () => router.push("/players"),
    },
    { title: t("profile.stepReview"), hint: t("profile.stepReviewHint"), done: false },
  ];
  const doneCount = steps.filter((step) => step.done).length;

  // Greyed-out rows that preview "Where you win"
  const previews = [
    { label: t("side.rightSide"), width: "60%" },
    { label: t("side.leftSide"), width: "40%" },
    { label: t("profile.higherOpponents"), width: "30%" },
  ] as const;

  return (
    <>
      <Card className="gap-0 pb-1">
        <View className="mb-2 flex-row items-center justify-between">
          <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
            {t("profile.getStarted")}
          </Text>
          <Text className="font-bold text-[13px] text-accent-text">
            {t("profile.stepsDone", { done: doneCount, total: steps.length })}
          </Text>
        </View>
        <View className="mb-1 h-1.5 rounded-[3px] bg-track">
          <View className="h-1.5 rounded-[3px] bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </View>
        {steps.map((step, index) => (
          <Step key={step.title} {...step} last={index === steps.length - 1} />
        ))}
      </Card>

      <Card>
        <View className="flex-row items-baseline justify-between">
          <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
            {t("profile.levelOverTime")}
          </Text>
          <Text className="font-bold text-[13px] text-muted-icon">
            {t("profile.startsAt", { level: levelLabel })}
          </Text>
        </View>
        <View className="items-center justify-center" style={{ height: CHART_HEIGHT }}>
          <Svg width="100%" height={CHART_HEIGHT} style={{ position: "absolute" }}>
            <Line x1="0" y1="45" x2="100%" y2="45" stroke={dash} strokeWidth={2.5} strokeDasharray="6 6" />
            <Circle cx="8" cy="45" r="6" fill={accent} stroke={surface} strokeWidth={3} />
          </Svg>
          <Text className="bg-surface px-2 py-0.5 font-bold text-[13px] text-muted">
            {t("profile.chartAfterFirstMatch")}
          </Text>
        </View>
      </Card>

      <Card>
        <View className="flex-row items-center justify-between">
          <Text accessibilityRole="header" className="font-black text-[17px] text-foreground">
            {t("profile.whereYouWin")}
          </Text>
          <View className="flex-row items-center gap-1 rounded-[10px] bg-fill px-2.5 py-1">
            <Icon as={Lock} size={14} color="muted" />
            <Text className="font-bold text-[12px] text-muted">
              {t("profile.afterMatches", { count: STATS_MIN_MATCHES })}
            </Text>
          </View>
        </View>
        <Text className="font-normal text-[13px] leading-[18px] text-muted">{t("profile.whereYouWinHint")}</Text>
        {previews.map(({ label, width }) => (
          <View key={label} className="gap-1" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View className="flex-row justify-between">
              <Text className="font-bold text-[13px] text-muted-icon">{label}</Text>
              <Text className="font-black text-[13px] text-line-input">–</Text>
            </View>
            <View className="h-2 rounded bg-fill">
              <View className="h-2 rounded bg-line" style={{ width }} />
            </View>
          </View>
        ))}
      </Card>

      <Card className="flex-row items-center gap-3.5">
        <View accessibilityElementsHidden className="flex-row">
          <View className="size-9 rounded-full border-2 border-dashed border-primary-outline" />
          <View className="-ms-2.5 size-9 rounded-full border-2 border-dashed border-primary-outline bg-surface" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-black text-[15px] text-foreground">{t("profile.partnersReviews")}</Text>
          <Text className="font-normal text-[13px] leading-[18px] text-muted">
            {t("profile.partnersReviewsHint")}
          </Text>
        </View>
      </Card>
    </>
  );
}
