import { ReduceMotion, ZoomIn } from "react-native-reanimated";

// One place for animation timing so the app moves the same everywhere.
// Animate transform and opacity only, keep it short, never loop.

/** A small element appearing because of something the player just did (a seat filled, a score confirmed) */
export const popIn = ZoomIn.springify().damping(13).stiffness(240).reduceMotion(ReduceMotion.System);
