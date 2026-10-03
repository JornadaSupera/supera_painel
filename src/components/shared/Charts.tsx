import { useId, type ReactElement } from "react";
import {
  Area,
  AreaChart as RAreaChart,
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type RectangleProps,
} from "recharts";

import { useMediaQuery } from "@/hooks/useMediaQuery";
import { SkeletonChart } from "./Skeletons";
import { EmptyState, ErrorState, type ErrorLike } from "./StateBlock";

/**
 * Chart wrappers.
 *
 * They exist so no screen configures Recharts by hand: the palette, the axes,
 * the tooltip and the empty/error/loading states stay identical across the
 * whole panel.
 */

/**
 * Series palette.
 *
 * The order is fixed: `--chart-1` is always the first series. Readers associate
 * a colour with a category across screens — reordering breaks that reading.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export interface Series {
  key: string;
  label: string;
}

const formatValue = (value: unknown): string =>
  typeof value === "number" ? value.toLocaleString("pt-BR") : String(value ?? "");

/**
 * Entrance animation shared by every chart: shorter than Recharts' default
 * (1.5 s reads as the screen hanging) and off for people who ask for less
 * motion.
 */
function useChartMotion() {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  return {
    isAnimationActive: !reduceMotion,
    animationDuration: 700,
    animationEasing: "ease-out",
  } as const;
}

/** A DOM-safe id for a gradient, unique per chart instance. */
function useGradientId(): string {
  return useId().replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Vertical fade of a series colour, from the `from` opacity at the top to the
 * `to` opacity at the bottom.
 * The colour is a CSS variable, so it follows the theme.
 */
function SeriesGradient({
  id,
  color,
  from,
  to,
}: {
  id: string;
  color: string;
  from: number;
  to: number;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" style={{ stopColor: color, stopOpacity: from }} />
      <stop offset="100%" style={{ stopColor: color, stopOpacity: to }} />
    </linearGradient>
  );
}

/**
 * Bar painted with a gradient.
 *
 * The series keeps its solid `fill`, which is what the legend and tooltip read;
 * only the drawn rectangle swaps to the gradient. Putting the gradient in
 * `fill` would give the tooltip a swatch of `url(#…)`, which is not a colour.
 */
function GradientBar({ gradientId, ...props }: RectangleProps & { gradientId: string }) {
  return <Rectangle {...props} fill={`url(#${gradientId})`} />;
}

/* --------------------------------------------------------------- tooltip */

interface TooltipItem {
  dataKey?: string | number;
  name?: string | number;
  value?: unknown;
  color?: string;
  payload?: { fill?: string };
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: unknown;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-popover text-popover-foreground border-border min-w-35 rounded-lg border p-3 text-xs shadow-lg">
      {label !== undefined && (
        <p className="border-border mb-2 border-b pb-2 font-semibold">{String(label)}</p>
      )}

      {payload.map((item, i) => (
        <p key={item.dataKey ?? i} className="flex items-center gap-2 py-0.5">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: item.color ?? item.payload?.fill }}
          />
          <span className="text-muted-foreground flex-1">{item.name}</span>
          <span className="font-mono font-medium">
            {formatValue(item.value)}
            {suffix}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ shell */

/**
 * Handles loading, error and empty BEFORE mounting the chart.
 * Mounting Recharts with an empty array produces ghost axes — better not to
 * mount at all.
 *
 * > [!] PRECEDENCE: error, then loading, then empty — the same order as
 * > `DataTable`, and the two used to disagree.
 * The chart checked `loading` first, so a failed read that was being retried
 * kept showing a skeleton: the screen said "loading" about something that had
 * already failed, and the table right next to it said "error" about the same
 * request. Whichever order is chosen, the two shells have to agree, or the same
 * failure reads as two different states on one screen.
 *
 * Error first is the honest order: a request that failed is not in progress,
 * and the retry belongs to the person, not to a spinner.
 */
function ChartFrame({
  loading,
  error,
  onRetry,
  empty,
  height = 280,
  children,
}: {
  loading?: boolean;
  error?: ErrorLike;
  onRetry?: () => void;
  empty: boolean;
  height?: number;
  children: ReactElement;
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} compact />;
  if (loading) return <SkeletonChart />;

  if (empty) {
    return (
      <EmptyState
        compact
        title="Sem dados no período"
        description="Ajuste o período ou os filtros para ver resultados."
      />
    );
  }

  return (
    // The global classes below wire the Recharts axes and legend to the theme
    // tokens — including a light/dark switch without a reload.
    <div
      style={{ height }}
      className="w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-axis-tick_text]:font-mono [&_.recharts-cartesian-axis-tick_text]:text-[11px] [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-cartesian-grid_line]:opacity-60 [&_.recharts-legend-item-text]:!text-muted-foreground [&_.recharts-legend-item-text]:!text-xs"
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const AXIS = { axisLine: false, tickLine: false, tickMargin: 8 } as const;
const MARGIN = { top: 8, right: 8, bottom: 0, left: -12 } as const;

interface ChartBaseProps {
  height?: number;
  loading?: boolean;
  error?: ErrorLike;
  onRetry?: () => void;
  legend?: boolean;
  suffix?: string;
}

/* -------------------------------------------------------------------- bar */

/** A horizontal target/capacity line, dashed so it never reads as a data bar. */
export interface ChartReferenceLine {
  y: number;
  label: string;
}

export interface BarChartProps<T> extends ChartBaseProps {
  data: T[];
  xKey: string;
  series: Series[];
  stacked?: boolean;
  referenceLines?: ChartReferenceLine[];
  /**
   * Ticks only at whole numbers. For counts: a y axis marked 0,25 / 0,75 on a
   * chart of patients or answers reads as a fraction of a person.
   */
  integerAxis?: boolean;
}

export function BarChart<T>({
  data,
  xKey,
  series,
  stacked = false,
  referenceLines = [],
  integerAxis = false,
  suffix = "",
  height,
  loading,
  error,
  onRetry,
  legend = false,
}: BarChartProps<T>) {
  const motion = useChartMotion();
  const gradientId = useGradientId();

  return (
    <ChartFrame loading={loading} error={error} onRetry={onRetry} empty={data.length === 0} height={height}>
      <RBarChart data={data} margin={MARGIN}>
        <defs>
          {series.map((item, i) => (
            <SeriesGradient
              key={item.key}
              id={`${gradientId}-${i}`}
              color={CHART_COLORS[i % CHART_COLORS.length] ?? "var(--chart-1)"}
              from={1}
              to={0.62}
            />
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} allowDecimals={!integerAxis} tickFormatter={formatValue} />
        <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        {legend && <Legend iconType="circle" iconSize={8} />}

        {series.map((item, i) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId={stacked ? "total" : undefined}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            shape={<GradientBar gradientId={`${gradientId}-${i}`} />}
            // Rounds only the top of the last series in the stack.
            radius={stacked && i < series.length - 1 ? 0 : [6, 6, 0, 0]}
            maxBarSize={48}
            {...motion}
          />
        ))}

        {referenceLines.map((linha) => (
          <ReferenceLine
            key={linha.label}
            y={linha.y}
            // Without this, a Y axis that auto-scales to the bars alone clips
            // any reference line above the tallest bar — which is the common
            // case, since a target is usually above where volume actually is.
            ifOverflow="extendDomain"
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            label={{ value: `${linha.label} · ${formatValue(linha.y)}`, position: "insideTopRight", fill: "var(--muted-foreground)", fontSize: 11 }}
          />
        ))}
      </RBarChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------- line */

export interface LineChartProps<T> extends ChartBaseProps {
  data: T[];
  xKey: string;
  series: Series[];
}

export function LineChart<T>({
  data,
  xKey,
  series,
  suffix = "",
  height,
  loading,
  error,
  onRetry,
  legend = false,
}: LineChartProps<T>) {
  const motion = useChartMotion();
  const gradientId = useGradientId();

  return (
    <ChartFrame loading={loading} error={error} onRetry={onRetry} empty={data.length === 0} height={height}>
      <RAreaChart data={data} margin={MARGIN}>
        <defs>
          {series.map((item, i) => (
            <SeriesGradient
              key={item.key}
              id={`${gradientId}-${i}`}
              color={CHART_COLORS[i % CHART_COLORS.length] ?? "var(--chart-1)"}
              from={0.22}
              to={0}
            />
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} tickFormatter={formatValue} />
        <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ stroke: "var(--border)" }} />
        {legend && <Legend iconType="circle" iconSize={8} />}

        {series.map((item, i) => (
          // An area chart drawn as a line with a soft fade under it: the stroke
          // stays the series colour, which is what legend and tooltip read.
          <Area
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            fill={`url(#${gradientId}-${i})`}
            dot={false}
            activeDot={{ r: 4 }}
            {...motion}
          />
        ))}
      </RAreaChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ donut */

export interface DonutDatum {
  name: string;
  value: number;
}

/**
 * Distribution — patients by ICD code, by specialty.
 * The total in the centre saves the reader from adding the slices up.
 */
export function DonutChart({
  data,
  totalLabel = "total",
  height = 280,
  loading,
  error,
  onRetry,
}: ChartBaseProps & { data: DonutDatum[]; totalLabel?: string }) {
  const motion = useChartMotion();
  const total = data.reduce((sum, item) => sum + (Number(item.value) || 0), 0);

  return (
    <ChartFrame loading={loading} error={error} onRetry={onRetry} empty={data.length === 0} height={height}>
      <RPieChart>
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={8} verticalAlign="bottom" />

        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
          cornerRadius={4}
          {...motion}
        >
          {data.map((item, i) => (
            <Cell key={item.name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}

          <text
            x="50%"
            y="46%"
            textAnchor="middle"
            className="fill-foreground font-mono text-2xl font-semibold"
          >
            {formatValue(total)}
          </text>
          <text
            x="50%"
            y="55%"
            textAnchor="middle"
            className="fill-muted-foreground text-2xs tracking-wide uppercase"
          >
            {totalLabel}
          </text>
        </Pie>
      </RPieChart>
    </ChartFrame>
  );
}
