import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { LevelBadge } from "./PageHeader";
import { cn } from "@/lib/utils";

/**
 * Indicator card (KPI).
 *
 * Reference structure, top to bottom:
 *
 *     ┌──────────────────────────────┐
 *     │ [icon]             [+8 mês]  │  ← accent on the left, delta on the right
 *     │                              │
 *     │ PACIENTES ATIVOS             │  ← label, uppercase and small
 *     │ 127                          │  ← value, the only large element
 *     │ em tratamento                │  ← context
 *     └──────────────────────────────┘
 *
 * The value uses `tabular-nums` rather than a monospaced font: it keeps the
 * Geist face of the rest of the interface and still lines the digits up in a
 * column across cards.
 */

export interface StatCardProps {
  label: string;
  value?: string | number;
  /** Suffix glued to the value: "%", "min". */
  unit?: string;
  /** Delta: positive goes up, negative goes down. */
  delta?: number;
  /**
   * Unit of the delta. "%" percentage · "pp" percentage points · "" absolute.
   * Adding percentage points as if they were percentages is a classic reading
   * mistake — hence the explicit distinction.
   */
  deltaUnit?: string;
  /** Comparison basis, shown inside the pill: "mês", "semana". */
  period?: string;
  /** Line under the value: "em tratamento". */
  context?: string;
  /** For when falling is good — open alerts, response time. */
  invertColor?: boolean;
  icon?: ReactNode;
  /** Classes for the icon accent: `bg-supera-uniao/10 text-supera-uniao`. */
  accent?: string;
  /**
   * Scope level. A Médio-level indicator gets the reference pill in the card
   * corner — that is how the client checks what was contracted.
   */
  level?: "mvp" | "medio";
  /** Drill-down to the matching report. */
  onClick?: () => void;
  loading?: boolean;
  className?: string;
}

const BASE = "bg-card text-card-foreground flex min-w-0 flex-col rounded-2xl border p-4";

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaUnit = "%",
  period,
  context,
  invertColor = false,
  icon,
  accent = "bg-primary/10 text-primary",
  level,
  onClick,
  loading = false,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      // Same height as the final content: the KPI row does not jump when the
      // data arrives.
      <div className={cn(BASE, className)} aria-busy="true">
        <div className="flex items-start justify-between">
          <Skeleton className="size-7 rounded-lg" />
          <Skeleton className="h-4 w-14 rounded-md" />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <span className="sr-only">Carregando indicador</span>
      </div>
    );
  }

  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const wentUp = hasDelta && delta > 0;
  const wentDown = hasDelta && delta < 0;
  const good = invertColor ? wentDown : wentUp;
  const bad = invertColor ? wentUp : wentDown;

  const TrendIcon = wentUp ? TrendingUp : wentDown ? TrendingDown : Minus;

  const content = (
    <>
      <div className="flex items-start justify-between gap-2">
        {icon && (
          <span aria-hidden="true" className={cn("rounded-lg p-1.5 [&_svg]:size-4", accent)}>
            {icon}
          </span>
        )}

        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold [&_svg]:size-3",
              // The project's grade scale: mood-1 is the lime green of "good",
              // mood-5 the red of "bad".
              good
                ? "bg-mood-1/10 text-mood-1"
                : bad
                  ? "bg-mood-5/10 text-mood-5"
                  : "bg-muted text-muted-foreground",
            )}
          >
            <TrendIcon aria-hidden="true" />
            {delta > 0 ? "+" : ""}
            {delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
            {deltaUnit}
            {period && ` ${period}`}
          </span>
        )}
      </div>

      <div className="mt-3 min-w-0">
        <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">
          {value}
          {unit}
        </p>
        {context && <p className="text-muted-foreground text-[11px]">{context}</p>}
      </div>
    </>
  );

  const card = onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        BASE,
        "hover:border-primary/40 h-full w-full cursor-pointer text-left transition-[border-color,box-shadow] hover:shadow-sm",
        !level && className,
      )}
    >
      {content}
    </button>
  ) : (
    <div className={cn(BASE, "h-full", !level && className)}>{content}</div>
  );

  if (level !== "medio") return card;

  // The level pill floats over the card corner, as in the reference. The
  // `relative` wrapper exists only to anchor it.
  return (
    <div className={cn("relative", className)}>
      {card}
      <LevelBadge level="Médio" className="absolute right-2 bottom-2" />
    </div>
  );
}

export default StatCard;
