import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { STEP_DURATION } from "@/lib/motion";

type SetupProgressProps = {
  /** Current step, from 1 */
  step: number;
  total?: number;
  /** How much of the current step is done, 0–1 (e.g. quiz questions answered). Full by default. */
  stepProgress?: number;
};

/** Segmented progress bar with "n of 3" on the right (design.md "Progress (setup)"). */
export function SetupProgress({ step, total = 3, stepProgress = 1 }: SetupProgressProps) {
  const { t } = useTranslation();

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t("setup.progressA11y", { step, total })}
      className="flex-row items-center gap-3.5"
    >
      <View className="flex-1 flex-row gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const fill = i < step - 1 ? 1 : i === step - 1 ? stepProgress : 0;
          return <Segment key={i} fill={fill} />;
        })}
      </View>
      <Text className="font-semibold text-[14px] text-muted">
        {t("setup.progress", { step, total })}
      </Text>
    </View>
  );
}

/** One segment of the bar; its fill grows or shrinks to the new value instead of jumping. */
function Segment({ fill }: { fill: number }) {
  const width = useSharedValue(fill);
  useEffect(() => {
    width.value = withTiming(fill, { duration: STEP_DURATION });
  }, [fill, width]);

  // Width on a 6 px bar is cheap, and unlike scaleX it fills from the start side in RTL too
  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View className="h-1.5 flex-1 overflow-hidden rounded-[3px] bg-line-input">
      <Animated.View className="h-full bg-accent" style={fillStyle} />
    </View>
  );
}
