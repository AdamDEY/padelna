import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

type Options = {
  /** Where the first count starts from */
  from: number;
  /** The first count waits this long (ms) and runs for `duration`; later changes run for `changeDuration` */
  delay: number;
  duration: number;
  changeDuration: number;
};

/**
 * A number that counts to `target` instead of jumping: from `from` the first time, and from where it
 * is when the target changes later. Eases out like the bar it sits above. With Reduce Motion on it
 * just shows the target.
 */
export function useAnimatedNumber(target: number, { from, delay, duration, changeDuration }: Options) {
  const reduceMotion = useReducedMotion();
  const [value, setValue] = useState(reduceMotion ? target : from);
  const current = useRef(value);
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (reduceMotion) {
      current.current = target;
      return;
    }

    const wasFirstRun = isFirstRun.current;
    isFirstRun.current = false;
    const start = current.current;
    const length = wasFirstRun ? duration : changeDuration;
    let frame: number | undefined;

    const timer = setTimeout(
      () => {
        const startedAt = Date.now();
        const tick = () => {
          const progress = Math.min(1, (Date.now() - startedAt) / length);
          const eased = 1 - (1 - progress) ** 3;
          current.current = start + (target - start) * eased;
          setValue(current.current);
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      wasFirstRun ? delay : 0,
    );

    return () => {
      clearTimeout(timer);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [target, reduceMotion, delay, duration, changeDuration]);

  return reduceMotion ? target : value;
}
