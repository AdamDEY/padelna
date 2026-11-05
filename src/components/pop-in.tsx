import type { ReactNode } from "react";
import Animated from "react-native-reanimated";

import { popIn } from "@/lib/motion";

type PopInProps = {
  /** Off for what is already on screen when the page opens, so only changes animate */
  animate: boolean;
  /** Wait this many ms before popping in */
  delay?: number;
  children: ReactNode;
};

/** Pops its content in with a small spring when it mounts (give it a `key` that changes with the thing it shows). */
export function PopIn({ animate, delay, children }: PopInProps) {
  return (
    <Animated.View entering={animate ? (delay ? popIn.delay(delay) : popIn) : undefined}>
      {children}
    </Animated.View>
  );
}
