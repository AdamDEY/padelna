import { Slider } from "heroui-native";
import { TrendingUp } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { InfoNote } from "@/components/info-note";
import { LevelGauge } from "@/components/level-gauge";
import { PopIn } from "@/components/pop-in";
import {
  ADJUST_STEP,
  levelBand,
  MAX_LEVEL,
  MIN_LEVEL,
  type SkillId,
} from "@/data/level-quiz";
import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { adjustBounds, clampLevel, roundLevel } from "@/lib/level-quiz-score";
import {
  LEVEL_ADJUST_MS,
  LEVEL_REVEAL_DELAY_MS,
  LEVEL_REVEAL_MS,
  riseIn,
} from "@/lib/motion";

type SetupLevelResultProps = {
  /** Level from the quiz, before the player moves it */
  baseLevel: number;
  /** How far the player moved it, in levels (e.g. -0.2) */
  adjustment: number;
  onAdjust: (adjustment: number) => void;
  strongest?: SkillId;
  weakest?: SkillId;
};

/** Level shown for a base level and an adjustment, kept on the 1–7 scale. */
export function adjustedLevel(baseLevel: number, adjustment: number) {
  return roundLevel(clampLevel(baseLevel + adjustment));
}

function formatAdjustment(adjustment: number) {
  const sign = adjustment > 0 ? "+" : adjustment < 0 ? "−" : "";
  return `${sign}${Math.abs(adjustment).toFixed(1)}`;
}

/**
 * Profile setup, after the quiz: the player's starting level with a slider to move it up or down
 * by half a level (design artboard "Profile setup · Starting level"). The quiz result is only a
 * starting point, so this screen is the player's one chance to correct it before matches do.
 *
 * The blocks rise in one by one, then the level counts up from 1.0 while its gauge fills, and the
 * band tag pops in as it lands. Moving the slider makes the number and bar follow.
 */
export function SetupLevelResult({
  baseLevel,
  adjustment,
  onAdjust,
  strongest,
  weakest,
}: SetupLevelResultProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const level = adjustedLevel(baseLevel, adjustment);
  const band = t(`setup.result.bands.${levelBand(level)}`);
  const bounds = adjustBounds(baseLevel);
  const fill = ((level - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL)) * 100;

  const shownLevel = useAnimatedNumber(level, {
    from: MIN_LEVEL,
    delay: LEVEL_REVEAL_DELAY_MS,
    duration: LEVEL_REVEAL_MS,
    changeDuration: LEVEL_ADJUST_MS,
  });

  // The gauge uses the same curve and timing as the number, so they arrive together
  const gaugeProgress = useSharedValue(reduceMotion ? fill : 0);
  const isFirstFill = useRef(true);
  useEffect(() => {
    const isFirst = isFirstFill.current;
    isFirstFill.current = false;
    if (reduceMotion) {
      gaugeProgress.value = fill;
      return;
    }
    const grow = withTiming(fill, {
      duration: isFirst ? LEVEL_REVEAL_MS : LEVEL_ADJUST_MS,
      easing: Easing.out(Easing.cubic),
    });
    gaugeProgress.value = isFirst ? withDelay(LEVEL_REVEAL_DELAY_MS, grow) : grow;
  }, [fill, gaugeProgress, reduceMotion]);

  return (
    <>
      <Animated.View entering={riseIn(0)}>
        <Text
          accessibilityRole="header"
          className="font-black text-[28px] leading-[32px] tracking-[-0.5px] text-foreground"
        >
          {t("setup.result.title")}
        </Text>
      </Animated.View>

      <Animated.View
        entering={riseIn(1)}
        accessible
        accessibilityLabel={t("setup.result.a11y", { level: level.toFixed(1), max: MAX_LEVEL, band })}
        className="items-center gap-4 rounded-3xl border border-line bg-surface px-5 py-5"
      >
        <LevelGauge progress={gaugeProgress} minLabel={String(MIN_LEVEL)} maxLabel={String(MAX_LEVEL)}>
          {/* A line height equal to the font size crops the top of Nunito's heavy digits */}
          <Text
            className="font-black text-[56px] leading-[68px] tracking-[-2px] text-accent"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {shownLevel.toFixed(1)}
          </Text>
        </LevelGauge>
        {/* Pops in just as the count lands */}
        <PopIn animate={!reduceMotion} delay={LEVEL_REVEAL_DELAY_MS + LEVEL_REVEAL_MS - 150}>
          <View className="rounded-xl bg-warning-soft px-3 py-1.5">
            <Text className="font-bold text-[13px] text-warning">{t("setup.result.tag", { band })}</Text>
          </View>
        </PopIn>
      </Animated.View>

      <Animated.View
        entering={riseIn(2)}
        className="gap-2.5 rounded-[20px] border border-dashed border-primary-outline bg-surface px-4 py-3.5"
      >
        <View className="flex-row items-center justify-between">
          <Text className="font-bold text-[15px] text-foreground">{t("setup.result.adjustTitle")}</Text>
          <View className="rounded-[10px] bg-accent-soft px-2.5 py-0.5">
            <Text className="font-black text-[13px] text-accent">
              {adjustment === 0 ? t("setup.result.adjustNone") : formatAdjustment(adjustment)}
            </Text>
          </View>
        </View>
        <Slider
          value={adjustment}
          onChange={(next) => typeof next === "number" && onAdjust(roundLevel(next))}
          minValue={bounds.min}
          maxValue={bounds.max}
          step={ADJUST_STEP}
          accessibilityLabel={t("setup.result.adjustA11y")}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <View className="flex-row justify-between">
          <Text className="font-semibold text-[12px] text-muted">{formatAdjustment(bounds.min)}</Text>
          <Text className="font-semibold text-[12px] text-muted">{t("setup.result.adjustNone")}</Text>
          <Text className="font-semibold text-[12px] text-muted">{formatAdjustment(bounds.max)}</Text>
        </View>
      </Animated.View>

      {strongest && weakest ? (
        <Animated.View entering={riseIn(3)} className="flex-row gap-2.5">
          <View className="flex-1 gap-0.5 rounded-2xl bg-success-soft px-3.5 py-3">
            <Text className="font-semibold text-[12px] text-success">{t("setup.result.strongest")}</Text>
            <Text className="font-black text-[16px] text-foreground">
              {t(`setup.result.skills.${strongest}`)}
            </Text>
          </View>
          <View className="flex-1 gap-0.5 rounded-2xl bg-attention-soft px-3.5 py-3">
            <Text className="font-semibold text-[12px] text-attention">{t("setup.result.toWorkOn")}</Text>
            <Text className="font-black text-[16px] text-foreground">
              {t(`setup.result.skills.${weakest}`)}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={riseIn(4)}>
        <InfoNote icon={TrendingUp} title={t("setup.result.noteTitle")}>
          {t("setup.result.noteText")}
        </InfoNote>
      </Animated.View>
    </>
  );
}
