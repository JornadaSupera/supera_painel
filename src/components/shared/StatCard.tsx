import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/useCountUp";
import { formatNumber, parseFormattedNumber } from "@/lib/format";
import { ENTER_CLASS, enterStyle } from "@/lib/motion";
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
  /** The delta already written out, for a format the card does not know (a duration). */
  deltaText?: string;
  /** Comparison basis, shown inside the pill: "mês", "semana". */
  period?: string;
  /** Line under the value: "em tratamento". */
  context?: string;
  /** For when falling is good — open alerts, response time. */
  invertColor?: boolean;
  icon?: ReactNode;
  /** Classes for the icon accent: `bg-supera-uniao/10 text-supera-uniao`. */
  accent?: string;
  /** Drill-down to the matching report. */
  onClick?: () => void;
  loading?: boolean;
  /**
   * Delay in ms for the entrance animation. Pass it (0 included) on cards that
   * appear together, ordered, so they come in one after the other; leave it out
   * and the card just appears.
   */
  enterDelay?: number;
  className?: string;
}

const BASE = "bg-card text-card-foreground flex min-w-0 flex-col rounded-2xl border p-4";

/**
 * The value, climbing from zero when it is a number the card can rebuild
 * ("1.234", "4,7"). Durations and dashes pass through untouched.
 *
 * The animated text is hidden from assistive technology and the final one
 * announced instead, so a screen reader never reads "37" on the way to "127".
 */
function AnimatedValue({ value }: { value?: string | number }) {
  const parsed =
    typeof value === "number"
      ? {
          value,
          decimals: Number.isInteger(value) ? 0 : (String(value).split(".")[1]?.length ?? 0),
        }
      : typeof value === "string"
        ? parseFormattedNumber(value)
        : null;

  const current = useCountUp(parsed?.value ?? 0);
  if (!parsed) return <>{value}</>;

  return (
    <>
      <span aria-hidden="true">
        {formatNumber(current, {
          minimumFractionDigits: parsed.decimals,
          maximumFractionDigits: parsed.decimals,
        })}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaUnit = "%",
  deltaText,
  period,
  context,
  invertColor = false,
  icon,
  accent = "bg-primary/10 text-primary",
  onClick,
  loading = false,
  enterDelay,
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
          <span
            aria-hidden="true"
            className={cn(
              "rounded-lg p-1.5 transition-transform duration-200 group-hover:scale-110 motion-reduce:transition-none [&_svg]:size-4",
              accent,
            )}
          >
            {icon}
          </span>
        )}

        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold [&_svg]:size-3",
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
            {deltaText ?? (
              <>
                {delta > 0 ? "+" : ""}
                {delta.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                {deltaUnit}
              </>
            )}
            {period && ` ${period}`}
          </span>
        )}
      </div>

      <div className="mt-3 min-w-0">
        <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">
          <AnimatedValue value={value} />
          {unit}
        </p>
        {context && <p className="text-muted-foreground text-[11px]">{context}</p>}
      </div>
    </>
  );

  const enter = enterDelay === undefined ? undefined : ENTER_CLASS;
  const enterAt = enterStyle(enterDelay);

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={enterAt}
        className={cn(
          BASE,
          // Lifts a few pixels on hover and settles back when pressed: the card
          // is a link to a report, and should feel like one.
          "group hover:border-primary/40 h-full w-full cursor-pointer text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          enter,
          className,
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div style={enterAt} className={cn(BASE, "h-full", enter, className)}>
      {content}
    </div>
  );
}

export default StatCard;
