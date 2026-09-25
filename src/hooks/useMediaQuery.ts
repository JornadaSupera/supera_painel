import { useSyncExternalStore } from "react";

/**
 * Tailwind's default breakpoints, as media queries.
 *
 * Kept next to the hook so a component that switches layout in JavaScript
 * uses the same thresholds as the `md:` / `xl:` classes around it. Two
 * definitions of "desktop" drift apart on the first tweak, and the screen
 * shows the table and the cards at the same time.
 */
export const BREAKPOINT = {
  md: "(min-width: 48rem)",
  lg: "(min-width: 64rem)",
  xl: "(min-width: 80rem)",
} as const;

/**
 * Whether a media query currently matches.
 *
 * For layouts that CSS alone cannot switch — rendering cards instead of a
 * table, or collapsing the sidebar by default. Rendering both and hiding one
 * with `hidden md:block` would mount every row twice, and a row carries
 * components with their own state (the reveal of a masked CPF, a menu).
 *
 *   const desktop = useMediaQuery(BREAKPOINT.md);
 *
 * `useSyncExternalStore` instead of state plus effect: the first render
 * already has the right answer, so nothing flashes the wrong layout.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
  );
}

export default useMediaQuery;
