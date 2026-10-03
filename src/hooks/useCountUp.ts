import { useEffect, useRef, useState } from "react";

import { useMediaQuery } from "./useMediaQuery";

/**
 * A number that climbs to `target` instead of appearing.
 *
 * It starts from zero on first render and from whatever is on screen when the
 * target changes, so a refreshed indicator moves rather than restarts. With
 * reduced motion it is simply the target.
 */
export function useCountUp(target: number, duration = 600): number {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [value, setValue] = useState(reduceMotion ? target : 0);
  const shown = useRef(value);

  useEffect(() => {
    if (reduceMotion) {
      shown.current = target;
      setValue(target);
      return;
    }

    const from = shown.current;
    if (from === target) return;

    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = progress === 1 ? target : from + (target - from) * eased;

      shown.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduceMotion]);

  return value;
}
