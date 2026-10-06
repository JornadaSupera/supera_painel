import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { BrandRibbon } from "./BrandRibbon";

/**
 * The brand-coloured surface: teal gradient, the outlined "s" pattern drifting
 * behind the content and clearing around the logo corner, a soft light/shadow
 * vignette and the six-colour ribbon on the base.
 *
 * Content is white on this surface in both themes. Whoever lays text over it
 * should keep it on a darkened card (`bg-black/25`), which is what holds white
 * text above AA against the lighter end of the gradient.
 *
 * Callers own the layout (padding, flex); this only paints the background.
 */
export function BrandSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "from-brand-panel-from to-brand-panel-to relative isolate overflow-hidden bg-linear-to-br text-white",
        className,
      )}
    >
      <div aria-hidden="true" className="supera-pattern" />
      {/* Breathing room: the pattern fades into the surface's own colour behind the logo, so
          the mark sits on a smooth area instead of on the lines. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-1 bg-[radial-gradient(ellipse_at_top_left,var(--brand-panel-from)_8%,transparent_45%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgb(255_255_255/0.18),transparent_55%),linear-gradient(to_top,rgb(0_0_0/0.3),transparent_50%)]"
      />
      {children}
      <BrandRibbon className="absolute inset-x-0 bottom-0" />
    </div>
  );
}
