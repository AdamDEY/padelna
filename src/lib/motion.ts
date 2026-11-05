import { I18nManager } from "react-native";
import { FadeInLeft, FadeInRight, ReduceMotion, ZoomIn } from "react-native-reanimated";

// One place for animation timing so the app moves the same everywhere.
// Animate transform and opacity only, keep it short, never loop.

export const STEP_DURATION = 220;

/** A page swapping in place (setup, onboarding): forward slides in from the reading direction's end, back from its start */
export function stepEntering(direction: "forward" | "back") {
  // Fade-in-right/left are physical, so Arabic (RTL) has to swap them
  const fromRight = (direction === "forward") !== I18nManager.isRTL;
  return (fromRight ? FadeInRight : FadeInLeft).duration(STEP_DURATION);
}

/** A small element appearing because of something the player just did (a seat filled, a score confirmed) */
export const popIn = ZoomIn.springify().damping(13).stiffness(240).reduceMotion(ReduceMotion.System);
