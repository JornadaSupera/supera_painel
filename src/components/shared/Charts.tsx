import type { ReactElement } from "react";
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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
    <div className="bg-popover text-popover-foreground border-border min-w-35 rounded-md border p-3 text-xs shadow-md">
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
  if (loading) return <SkeletonChart />;
  if (error) return <ErrorState error={error} onRetry={onRetry} compact />;

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
      className="w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-axis-tick_text]:font-mono [&_.recharts-cartesian-axis-tick_text]:text-[11px] [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-legend-item-text]:!text-muted-foreground [&_.recharts-legend-item-text]:!text-xs"
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

export interface BarChartProps<T> extends ChartBaseProps {
  data: T[];
  xKey: string;
  series: Series[];
  stacked?: boolean;
}

export function BarChart<T>({
  data,
  xKey,
  series,
  stacked = false,
  suffix = "",
  height,
  loading,
  error,
  onRetry,
  legend = false,
}: BarChartProps<T>) {
  return (
    <ChartFrame loading={loading} error={error} onRetry={onRetry} empty={data.length === 0} height={height}>
      <RBarChart data={data} margin={MARGIN}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} tickFormatter={formatValue} />
        <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        {legend && <Legend iconType="circle" iconSize={8} />}

        {series.map((item, i) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId={stacked ? "total" : undefined}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            // Rounds only the top of the last series in the stack.
            radius={stacked && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
            maxBarSize={48}
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
  return (
    <ChartFrame loading={loading} error={error} onRetry={onRetry} empty={data.length === 0} height={height}>
      <RLineChart data={data} margin={MARGIN}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} />
        <YAxis {...AXIS} tickFormatter={formatValue} />
        <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ stroke: "var(--border)" }} />
        {legend && <Legend iconType="circle" iconSize={8} />}

        {series.map((item, i) => (
          <Line
            key={item.key}
            type="monotone"
            dataKey={item.key}
            name={item.label}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </RLineChart>
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
