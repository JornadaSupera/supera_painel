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
 * Wrappers de gráfico.
 *
 * Existem para que nenhuma tela configure Recharts na mão: a paleta, os eixos,
 * o tooltip e os estados vazio/erro/carregando ficam iguais em todo o painel.
 */

/**
 * Paleta das séries.
 *
 * A ordem é fixa: `--chart-1` é sempre a primeira série. O leitor associa cor
 * a categoria entre telas — reordenar quebra essa leitura.
 */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export interface Serie {
  key: string;
  label: string;
}

const formatarValor = (valor: unknown): string =>
  typeof valor === "number" ? valor.toLocaleString("pt-BR") : String(valor ?? "");

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
  sufixo = "",
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: unknown;
  sufixo?: string;
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
            {formatarValor(item.value)}
            {sufixo}
          </span>
        </p>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- casca */

/**
 * Trata carregando, erro e vazio ANTES de montar o gráfico.
 * Montar Recharts com array vazio produz eixos fantasma — melhor não montar.
 */
function ChartFrame({
  loading,
  error,
  onRetry,
  vazio,
  altura = 280,
  children,
}: {
  loading?: boolean;
  error?: ErrorLike;
  onRetry?: () => void;
  vazio: boolean;
  altura?: number;
  children: ReactElement;
}) {
  if (loading) return <SkeletonChart />;
  if (error) return <ErrorState error={error} onRetry={onRetry} compacto />;

  if (vazio) {
    return (
      <EmptyState
        compacto
        titulo="Sem dados no período"
        descricao="Ajuste o período ou os filtros para ver resultados."
      />
    );
  }

  return (
    // As classes globais abaixo ligam os eixos e a legenda do Recharts aos
    // tokens do tema — inclusive na troca claro/escuro sem recarregar.
    <div
      style={{ height: altura }}
      className="w-full min-w-0 [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-axis-tick_text]:font-mono [&_.recharts-cartesian-axis-tick_text]:text-[11px] [&_.recharts-cartesian-grid_line]:stroke-border [&_.recharts-legend-item-text]:!text-muted-foreground [&_.recharts-legend-item-text]:!text-xs"
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

const EIXO = { axisLine: false, tickLine: false, tickMargin: 8 } as const;
const MARGEM = { top: 8, right: 8, bottom: 0, left: -12 } as const;

interface ChartBaseProps {
  altura?: number;
  loading?: boolean;
  error?: ErrorLike;
  onRetry?: () => void;
  legenda?: boolean;
  sufixo?: string;
}

/* ----------------------------------------------------------------- barras */

export interface BarChartProps<T> extends ChartBaseProps {
  data: T[];
  xKey: string;
  series: Serie[];
  empilhado?: boolean;
}

export function BarChart<T>({
  data,
  xKey,
  series,
  empilhado = false,
  sufixo = "",
  altura,
  loading,
  error,
  onRetry,
  legenda = false,
}: BarChartProps<T>) {
  return (
    <ChartFrame loading={loading} error={error} onRetry={onRetry} vazio={data.length === 0} altura={altura}>
      <RBarChart data={data} margin={MARGEM}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...EIXO} />
        <YAxis {...EIXO} tickFormatter={formatarValor} />
        <Tooltip content={<ChartTooltip sufixo={sufixo} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
        {legenda && <Legend iconType="circle" iconSize={8} />}

        {series.map((serie, i) => (
          <Bar
            key={serie.key}
            dataKey={serie.key}
            name={serie.label}
            stackId={empilhado ? "total" : undefined}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            // Arredonda só o topo da última série da pilha.
            radius={empilhado && i < series.length - 1 ? 0 : [4, 4, 0, 0]}
            maxBarSize={48}
          />
        ))}
      </RBarChart>
    </ChartFrame>
  );
}

/* ------------------------------------------------------------------ linha */

export interface LineChartProps<T> extends ChartBaseProps {
  data: T[];
  xKey: string;
  series: Serie[];
}

export function LineChart<T>({
  data,
  xKey,
  series,
  sufixo = "",
  altura,
  loading,
  error,
  onRetry,
  legenda = false,
}: LineChartProps<T>) {
  return (
    <ChartFrame loading={loading} error={error} onRetry={onRetry} vazio={data.length === 0} altura={altura}>
      <RLineChart data={data} margin={MARGEM}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...EIXO} />
        <YAxis {...EIXO} tickFormatter={formatarValor} />
        <Tooltip content={<ChartTooltip sufixo={sufixo} />} cursor={{ stroke: "var(--border)" }} />
        {legenda && <Legend iconType="circle" iconSize={8} />}

        {series.map((serie, i) => (
          <Line
            key={serie.key}
            type="monotone"
            dataKey={serie.key}
            name={serie.label}
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

/* ------------------------------------------------------------------ rosca */

export interface DonutDatum {
  nome: string;
  valor: number;
}

/**
 * Distribuição — pacientes por CID, por especialidade.
 * O total no centro evita que o leitor tenha de somar as fatias.
 */
export function DonutChart({
  data,
  totalLabel = "total",
  altura = 280,
  loading,
  error,
  onRetry,
}: ChartBaseProps & { data: DonutDatum[]; totalLabel?: string }) {
  const total = data.reduce((soma, item) => soma + (Number(item.valor) || 0), 0);

  return (
    <ChartFrame loading={loading} error={error} onRetry={onRetry} vazio={data.length === 0} altura={altura}>
      <RPieChart>
        <Tooltip content={<ChartTooltip />} />
        <Legend iconType="circle" iconSize={8} verticalAlign="bottom" />

        <Pie
          data={data}
          dataKey="valor"
          nameKey="nome"
          innerRadius="58%"
          outerRadius="82%"
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((item, i) => (
            <Cell key={item.nome} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}

          <text
            x="50%"
            y="46%"
            textAnchor="middle"
            className="fill-foreground font-mono text-2xl font-semibold"
          >
            {formatarValor(total)}
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
