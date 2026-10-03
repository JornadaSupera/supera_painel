import type { CSSProperties } from "react";

/**
 * Entrance for a block that appears after its data arrives: fades in and rises
 * a few pixels. `fill-mode-backwards` keeps it hidden during its own delay, so
 * a staggered row does not flash before its turn. Off for people who ask for
 * less motion.
 */
export const ENTER_CLASS =
  "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-backwards";

/** Delay for the n-th item of a staggered group. */
export function enterStyle(delayMs: number | undefined): CSSProperties | undefined {
  return delayMs === undefined ? undefined : { animationDelay: `${delayMs}ms` };
}
