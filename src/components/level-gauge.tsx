import type { ReactNode } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedProps, type SharedValue } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";

const AnimatedPath = Animated.createAnimatedComponent(Path);

type LevelGaugeProps = {
  /** How much of the gauge is filled, 0–100. A shared value, so the fill can animate without re-rendering. */
  progress: SharedValue<number>;
  /** What the left and right ends stand for, e.g. "1" and "7" */
  minLabel: string;
  maxLabel: string;
  /** Width of the gauge; its height is half of it */
  size?: number;
  strokeWidth?: number;
  /** Shown inside the arc, above the baseline */
  children?: ReactNode;
};

/** Semicircle gauge: a track arc from the left end over the top to the right end, with a rounded accent arc growing along it. */
export function LevelGauge({
  progress,
  minLabel,
  maxLabel,
  size = 240,
  strokeWidth = 16,
  children,
}: LevelGaugeProps) {
  const track = String(useCSSVariable("--color-track") ?? "");
  const accent = String(useCSSVariable("--color-accent") ?? "");
  const radius = (size - strokeWidth) / 2;
  const arcLength = Math.PI * radius;
  const centreY = size / 2;
  // Room for the rounded ends below the baseline
  const arcHeight = centreY + strokeWidth / 2;
  const path = `M ${strokeWidth / 2} ${centreY} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${centreY}`;

  const fillProps = useAnimatedProps(() => ({
    strokeDashoffset: arcLength * (1 - Math.min(100, Math.max(0, progress.value)) / 100),
  }));

  return (
    <View style={{ width: size }} className="items-center gap-1">
      <View style={{ width: size, height: arcHeight }}>
        <Svg width={size} height={arcHeight} aria-hidden>
          <Path d={path} stroke={track} strokeWidth={strokeWidth} strokeLinecap="round" fill="none" />
          <AnimatedPath
            d={path}
            stroke={accent}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={arcLength}
            animatedProps={fillProps}
            fill="none"
          />
        </Svg>
        <View className="absolute inset-x-0 bottom-0 items-center">{children}</View>
      </View>
      {/* Under the two ends of the arc */}
      <View
        className="flex-row justify-between self-stretch"
        style={{ paddingHorizontal: strokeWidth / 2 - 6 }}
      >
        <Text className="font-semibold text-[12px] text-muted">{minLabel}</Text>
        <Text className="font-semibold text-[12px] text-muted">{maxLabel}</Text>
      </View>
    </View>
  );
}
