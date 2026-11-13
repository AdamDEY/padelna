import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { PadelnaMark } from "@/components/padelna-logo";
import { CALCULATING_BOUNCES, CALCULATING_MS } from "@/lib/motion";

const BALL_SIZE = 88;
const BOUNCE_HEIGHT = 76;
// Each bounce is up and down, so the ball lands the last time just as the screen ends
const BOUNCE_MS = CALCULATING_MS / CALCULATING_BOUNCES;
const STEP_KEYS = ["answers", "skills", "level"] as const;

/**
 * Shown for a moment after the last quiz question, before the starting level: the Padelna ball
 * bounces while a bar fills and three short lines say what is being worked out. It ends on its own
 * (the setup screen swaps it for the result), so nothing here loops.
 */
export function SetupLevelCalculating() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  const lift = useSharedValue(0);
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    lift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: BOUNCE_MS / 2, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: BOUNCE_MS / 2, easing: Easing.in(Easing.quad) }),
      ),
      CALCULATING_BOUNCES,
      false,
    );
    progress.value = withTiming(1, { duration: CALCULATING_MS, easing: Easing.inOut(Easing.cubic) });
  }, [lift, progress, reduceMotion]);

  // One line per third of the time
  useEffect(() => {
    const timer = setInterval(
      () => setStepIndex((index) => Math.min(index + 1, STEP_KEYS.length - 1)),
      CALCULATING_MS / STEP_KEYS.length,
    );
    return () => clearInterval(timer);
  }, []);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * BOUNCE_HEIGHT }],
  }));
  // The shadow shrinks and fades as the ball rises
  const shadowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(lift.value, [0, 1], [0.35, 0.12]),
    transform: [{ scaleX: interpolate(lift.value, [0, 1], [1, 0.55]) }],
  }));
  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const line = t(`setup.calculating.${STEP_KEYS[stepIndex]}`);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("setup.calculating.title")}
      className="items-center gap-7 pt-24"
    >
      <View className="items-center" style={{ height: BALL_SIZE + BOUNCE_HEIGHT }}>
        <Animated.View style={ballStyle} className="absolute bottom-3">
          <PadelnaMark size={BALL_SIZE} />
        </Animated.View>
        {/* A little narrower than the ball, so it reads as its shadow on the floor */}
        <Animated.View
          style={[shadowStyle, { width: BALL_SIZE * 0.8 }]}
          className="absolute bottom-0 h-2 rounded-full bg-foreground"
        />
      </View>

      <View className="items-center gap-2">
        <Text
          accessibilityRole="header"
          className="text-center font-black text-[26px] leading-[31px] tracking-[-0.4px] text-foreground"
        >
          {t("setup.calculating.title")}
        </Text>
        <View className="h-6 justify-center">
          <Animated.Text
            key={stepIndex}
            entering={FadeInDown.duration(220)}
            exiting={FadeOutUp.duration(160)}
            accessibilityLiveRegion="polite"
            className="text-center font-semibold text-[15px] text-muted"
          >
            {line}
          </Animated.Text>
        </View>
      </View>

      <View className="h-1.5 w-48 overflow-hidden rounded-[3px] bg-track">
        <Animated.View className="h-full bg-accent" style={fillStyle} />
      </View>
    </View>
  );
}
