import { Accelerometer } from "expo-sensors";
import { useEffect, useRef } from "react";

// Readings per second are enough to catch a shake without draining the battery
const UPDATE_INTERVAL_MS = 100;
// Total pull in g: resting is 1, a firm shake goes well past 2
const SHAKE_THRESHOLD = 2.2;
// Two hard jolts this close together count as a shake, so a single bump in a bag doesn't
const SHAKE_WINDOW_MS = 700;
// After a shake, ignore the rest of the movement
const COOLDOWN_MS = 2000;

/** Calls `onShake` when the phone is shaken (while the app is open). Does nothing when `enabled` is false. */
export function useShake(onShake: () => void, enabled: boolean) {
  const callback = useRef(onShake);
  useEffect(() => {
    callback.current = onShake;
  });

  useEffect(() => {
    if (!enabled) return;

    let lastJoltAt = 0;
    let lastShakeAt = 0;
    Accelerometer.setUpdateInterval(UPDATE_INTERVAL_MS);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      if (Math.sqrt(x * x + y * y + z * z) < SHAKE_THRESHOLD) return;
      const now = Date.now();
      if (now - lastShakeAt < COOLDOWN_MS) return;
      if (now - lastJoltAt < SHAKE_WINDOW_MS) {
        lastShakeAt = now;
        callback.current();
      }
      lastJoltAt = now;
    });
    return () => subscription.remove();
  }, [enabled]);
}
