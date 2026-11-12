import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon } from "@/components/icon";
import { PopIn } from "@/components/pop-in";
import { subscribeToCelebrate } from "@/lib/celebrate";

const BALL_SIZE = 76;
const DROP_HEIGHT = 150;
const DROP_MS = 700;
// Long enough for the bounce to settle and the tick to be read, short enough not to block anything
const SHOW_MS = 1300;

/**
 * The lime ball drops, bounces and settles with a tick when a match is published or joined.
 * Mounted once at the root and started with `celebrate()`; it never takes touches.
 */
export function Celebration() {
  const reduceMotion = useReducedMotion();
  const [burst, setBurst] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(
    () =>
      subscribeToCelebrate(() => {
        setBurst((count) => count + 1);
        setIsVisible(true);
      }),
    [],
  );

  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => setIsVisible(false), SHOW_MS);
    return () => clearTimeout(timer);
  }, [isVisible, burst]);

  // The toast already says it worked, so with Reduce Motion there is nothing to add
  if (!isVisible || reduceMotion) return null;

  return (
    <Animated.View
      key={burst}
      entering={FadeIn.duration(100)}
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      className="absolute inset-0 items-center justify-center"
    >
      <Ball />
    </Animated.View>
  );
}

function Ball() {
  const dropY = useSharedValue(-DROP_HEIGHT);
  useEffect(() => {
    dropY.value = withTiming(0, { duration: DROP_MS, easing: Easing.bounce });
  }, [dropY]);

  const dropStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dropY.value }] }));

  return (
    <Animated.View style={dropStyle}>
      <View
        className="items-center justify-center rounded-full bg-lime"
        style={{ width: BALL_SIZE, height: BALL_SIZE }}
      >
        {/* The tick pops once the ball has landed */}
        <PopIn animate delay={DROP_MS - 150}>
          <Icon as={Check} size={38} color="on-lime" />
        </PopIn>
      </View>
    </Animated.View>
  );
}
