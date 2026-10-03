import type { ReactNode } from "react";

import { ENTER_CLASS, enterStyle } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Chart card used across the panel.
 *
 * Reference structure: `rounded-2xl border bg-card p-5`, header with a small
 * semibold title, an 11px description, and a chart with a fixed height of
 * 220px.
 *
 * Deliberately separate from the shadcn `Card`: that one brings `gap-6` and its
 * own padding blocks, designed for text content. Here the chart has to reach
 * the padding edges, with no extra spacing between header and body.
 */
export interface ChartCardProps {
  title: string;
  description?: ReactNode;
  /** Actions in the header corner — filter, view switch. */
  actions?: ReactNode;
  /** Spans two columns on the three-column grid. */
  wide?: boolean;
  /** Delay in ms for the entrance animation; leave out for none. */
  enterDelay?: number;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  description,
  actions,
  wide = false,
  enterDelay,
  className,
  children,
}: ChartCardProps) {
  return (
    <section
      style={enterStyle(enterDelay)}
      className={cn(
        "bg-card rounded-2xl border p-5 transition-shadow duration-200 hover:shadow-sm motion-reduce:transition-none",
        enterDelay !== undefined && ENTER_CLASS,
        wide && "lg:col-span-2",
        className,
      )}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {/* A div, not a p: the description is any node, and the loading
              skeleton some screens pass here is a div — invalid inside a p. */}
          {description && <div className="text-muted-foreground text-[11px]">{description}</div>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {children}
    </section>
  );
}

export default ChartCard;
