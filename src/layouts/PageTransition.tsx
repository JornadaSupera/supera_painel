import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";

import { ErrorBoundary } from "@/components/shared";

/**
 * Fades the page in when the route changes.
 *
 * The key restarts the CSS animation on every pathname — no animation library,
 * and still off for people who ask for less motion. It also remounts the page,
 * which is what a navigation already did when the route element changed; no
 * page here nests routes, so nothing with state worth keeping sits under it.
 *
 * It is also where a screen that fails stops: the error shows in the content
 * area, with the sidebar still there, and the remount clears it on the next
 * navigation.
 *
 * `space-y-6` mirrors the content container, so a page that returns several
 * sibling blocks keeps the rhythm it had before this wrapper existed.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div
      key={pathname}
      className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
    >
      <ErrorBoundary>{children}</ErrorBoundary>
    </div>
  );
}
