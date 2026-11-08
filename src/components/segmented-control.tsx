import { cn } from "heroui-native";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
// Gesture Handler's Pressable also receives taps inside bottom sheets
import { Pressable } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Icon } from "@/components/icon";

// Same measurements as HeroUI's segmented Tabs on the Matches screen
const TRACK_PADDING = 3;
const GAP = 4;
const OPTION_HEIGHT = 36;
const RADIUS = 21;

type SegmentedControlProps<T extends string> = {
  options: { value: T; label: string; icon?: LucideIcon }[];
  /** `undefined` shows no selection (a required choice nobody has made yet) */
  value: T | undefined;
  onChange: (value: T) => void;
  /** Smaller labels, for four short options in a row */
  size?: "md" | "sm";
};

/**
 * Equal-width segmented control with a sliding white pill. Looks like the
 * HeroUI Tabs on Matches, but works inside bottom sheets, where Tabs gets no taps.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: SegmentedControlProps<T>) {
  const [trackWidth, setTrackWidth] = useState(0);
  const optionWidth =
    trackWidth > 0
      ? (trackWidth - TRACK_PADDING * 2 - GAP * (options.length - 1)) / options.length
      : 0;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const translateX = useSharedValue(0);
  useEffect(() => {
    translateX.value = withTiming(selectedIndex * (optionWidth + GAP), { duration: 200 });
  }, [selectedIndex, optionWidth, translateX]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      className="flex-row bg-track"
      style={{ padding: TRACK_PADDING, gap: GAP, borderRadius: RADIUS }}
    >
      {optionWidth > 0 && value !== undefined ? (
        <Animated.View
          pointerEvents="none"
          className="absolute bg-segment"
          style={[
            {
              top: TRACK_PADDING,
              left: TRACK_PADDING,
              width: optionWidth,
              height: OPTION_HEIGHT,
              borderRadius: RADIUS,
              shadowColor: "#17202B",
              shadowOpacity: 0.08,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
            },
            pillStyle,
          ]}
        />
      ) : null}

      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={option.label}
            style={{
              flex: 1,
              height: OPTION_HEIGHT,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {option.icon && isSelected ? <Icon as={option.icon} size={16} color="success" /> : null}
            <Text
              className={cn(
                "font-semibold",
                size === "sm" ? "text-[13px]" : "text-[16px]",
                isSelected ? "text-segment-foreground" : "text-muted",
              )}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
