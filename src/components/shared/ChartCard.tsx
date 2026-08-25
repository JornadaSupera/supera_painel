import type { ReactNode } from "react";

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
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  description,
  actions,
  wide = false,
  className,
  children,
}: ChartCardProps) {
  return (
    <section className={cn("bg-card rounded-2xl border p-5", wide && "lg:col-span-2", className)}>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="text-muted-foreground text-[11px]">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>

      {children}
    </section>
  );
}

export default ChartCard;
