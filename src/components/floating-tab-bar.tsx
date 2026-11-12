import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect, useState } from "react";
import { I18nManager, Keyboard, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

// design.md "Glass tab bar": 66 px tall, 14 px from the sides, 26 px from the bottom
export const TAB_BAR_HEIGHT = 66;
const TAB_BAR_SIDE = 14;
const TAB_BAR_BOTTOM = 26;
// Keeps the bar clear of Android's gesture handle or 3-button bar
const SYSTEM_BAR_GAP = 8;
const BORDER = 1;
const CAPSULE_INSET = 4; // Inside the border, so the capsule sits 5 px from the edge
const CAPSULE_SPRING = { damping: 20, stiffness: 220, mass: 0.8 };

/** Distance from the bottom of the screen to the bottom of the bar. */
export function tabBarBottom(bottomInset: number) {
  return Math.max(TAB_BAR_BOTTOM, bottomInset + SYSTEM_BAR_GAP);
}

/**
 * Floating tab bar (design.md "Glass tab bar") for Android, where the native
 * bar is Material and can't take the iOS look. A white pill with a sliding
 * selected capsule; Android has no system glass, so the fill is opaque.
 */
export function FloatingTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  insets,
}: BottomTabBarProps) {
  const [width, setWidth] = useState(0);
  const keyboardVisible = useKeyboardVisible();
  // Children are laid out inside the 1 px border
  const itemWidth = (width - BORDER * 2) / state.routes.length;
  const capsuleX = useSharedValue(0);

  useEffect(() => {
    // The capsule starts at the start edge, so in Arabic it slides the other way
    const direction = I18nManager.isRTL ? -1 : 1;
    capsuleX.value = withSpring(direction * state.index * itemWidth, CAPSULE_SPRING);
  }, [capsuleX, state.index, itemWidth]);

  const capsuleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: capsuleX.value }],
  }));

  // Above the keyboard the bar would cover the field being typed in
  if (keyboardVisible) return null;

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      className="absolute flex-row rounded-full border border-line bg-surface"
      style={{
        start: TAB_BAR_SIDE,
        end: TAB_BAR_SIDE,
        bottom: tabBarBottom(insets.bottom),
        height: TAB_BAR_HEIGHT,
        boxShadow: "0 10px 34px rgba(23, 32, 43, 0.18)",
      }}
    >
      {width > 0 ? (
        <Animated.View
          className="absolute rounded-full bg-accent-soft"
          style={[
            {
              top: CAPSULE_INSET,
              bottom: CAPSULE_INSET,
              start: CAPSULE_INSET,
              width: itemWidth - CAPSULE_INSET * 2,
            },
            capsuleStyle,
          ]}
        />
      ) : null}
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const focused = state.index === index;
        const label = typeof options.title === "string" ? options.title : route.name;

        function onPress() {
          const event = emitter.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: "tabLongPress", target: route.key })}
            className="flex-1 items-center justify-center gap-0.5"
          >
            {options.tabBarIcon?.({ focused, color: "", size: 24 })}
            <Text
              numberOfLines={1}
              className={
                focused
                  ? "font-bold text-[11px] text-accent-text"
                  : "font-semibold text-[11px] text-muted-icon"
              }
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
