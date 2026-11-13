import { I18nManager } from "react-native";
import {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  LinearTransition,
  ReduceMotion,
  SlideOutLeft,
  ZoomIn,
} from "react-native-reanimated";

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

/** A row deleted with a swipe to the left keeps going off the screen that way */
export const slideOutLeft = SlideOutLeft.duration(STEP_DURATION);

/** The rows below a removed one glide up instead of snapping */
export const closeGap = LinearTransition.duration(STEP_DURATION);

// The starting-level moment in profile setup: a short "working it out" screen, then the level
// counts up while its bar fills. Both are one-off and never loop.

/** How long the "working out your level" screen stays, one bounce of the ball per 700 ms */
export const CALCULATING_MS = 2100;
export const CALCULATING_BOUNCES = 3;

/** The level counting up from 1.0 and the bar filling to it, after the cards have settled */
export const LEVEL_REVEAL_DELAY_MS = 350;
export const LEVEL_REVEAL_MS = 1200;

/** Moving the level with the slider: the number and bar follow quickly */
export const LEVEL_ADJUST_MS = 220;

const RISE_STAGGER_MS = 90;

/** Blocks of a page rising in one after the other, `index` being their place from the top */
export function riseIn(index: number) {
  return FadeInDown.delay(index * RISE_STAGGER_MS)
    .duration(300)
    .reduceMotion(ReduceMotion.System);
}
