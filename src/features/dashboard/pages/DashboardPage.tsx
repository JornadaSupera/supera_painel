import { Activity, ShieldAlert, Star, TrendingUp, UserPlus, Users } from "lucide-react";
import { useRef, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";

import {
  BarChart,
  ChartCard,
  DonutChart,
  ErrorState,
  LineChart,
  PageHeader,
  StatCard,
} from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";
import type { Periodo } from "@/lib/enums";
import { formatarDataExtenso, formatarNumero } from "@/lib/format";
import { BotaoExportar } from "../components/BotaoExportar";
import { PeriodoToggle } from "../components/PeriodoToggle";
import { useKpis, useSeries } from "../hooks/useDashboard";

/**
 * Painel executivo.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/
 *
 * Tudo aqui é agregado e anonimizado. Nenhum registro individual identificável
 * aparece nesta tela — o protótipo declara isso duas vezes, no cabeçalho e no
 * rodapé, e a regra vale também para o código: nenhuma métrica carrega
 * `paciente_id`, nome ou CPF.
 */

/**
 * Ícone e cor de acento de cada indicador.
 *
 * Fica na tela, não no mock: é decisão de apresentação. As cores vêm dos
 * valores da marca — repetir a primária nos cinco cartões apagaria a distinção
 * entre eles.
 */
const APRESENTACAO: Record<string, { icone: ComponentType; acento: string }> = {
  pacientes_ativos: { icone: Users, acento: "bg-primary/10 text-primary" },
  novos_pacientes: { icone: UserPlus, acento: "bg-supera-empatia/10 text-supera-empatia" },
  sessoes_quimio: { icone: Activity, acento: "bg-supera-uniao/10 text-supera-uniao" },
  engajamento_app: { icone: TrendingUp, acento: "bg-mood-1/10 text-mood-1" },
  nps: { icone: Star, acento: "bg-supera-amor/10 text-supera-amor" },
  alertas_ativos: { icone: ShieldAlert, acento: "bg-destructive/10 text-destructive" },
};

const SERIES_EFEITOS = [
  { key: "nausea", label: "Náusea" },
  { key: "fadiga", label: "Fadiga" },
  { key: "neuropatia", label: "Neuropatia" },
  { key: "diarreia", label: "Diarreia" },
];

const ALTURA_GRAFICO = 220;

export function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mensal");
  const navigate = useNavigate();
  const areaCaptura = useRef<HTMLDivElement>(null);

  const kpis = useKpis(periodo);
  const series = useSeries(periodo);

  const erroSeries = series.isError ? series.error : null;
  const recarregarSeries = () => void series.refetch();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Painel executivo"
        titulo="Visão geral"
        nivel="MVP"
        subtitulo={
          <>
            {formatarDataExtenso(new Date().toISOString())} ·{" "}
            <span className="text-muted-foreground">
              todos os números são agregados anonimizados
            </span>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <PeriodoToggle valor={periodo} onChange={setPeriodo} className="no-print" />
            <BotaoExportar alvo={areaCaptura} nomeBase="painel-executivo" />
          </div>
        }
      />

      <div ref={areaCaptura} className="flex flex-col gap-4">
        {/* ------------------------------------------------------------ KPIs */}
        <section aria-label="Indicadores">
          {kpis.isError ? (
            <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} compacto />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {kpis.isLoading
                ? Array.from({ length: 6 }, (_, i) => <StatCard key={i} label="" loading />)
                : kpis.data?.kpis.map((kpi) => {
                    const visual = APRESENTACAO[kpi.id];
                    const Icone = visual?.icone;

                    return (
                      <StatCard
                        key={kpi.id}
                        label={kpi.label}
                        valor={formatarNumero(kpi.valor)}
                        unidade={kpi.unidade}
                        variacao={kpi.variacao}
                        variacaoUnidade={kpi.variacao_unidade}
                        periodo={kpi.variacao_periodo}
                        contexto={kpi.contexto}
                        inverterCor={kpi.inverter_cor}
                        icone={Icone ? <Icone /> : undefined}
                        acento={visual?.acento}
                        nivel={kpi.nivel}
                        // Drill-down: cada indicador abre o relatório que o
                        // detalha (Fase 8).
                        onClick={
                          kpi.relatorio_slug
                            ? () => navigate(`/relatorios/${kpi.relatorio_slug}`)
                            : undefined
                        }
                      />
                    );
                  })}
            </div>
          )}
        </section>

        {/* -------------------------------------------------------- gráficos */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            largo
            titulo="Sessões de quimioterapia"
            descricao={
              series.data ? (
                <>
                  Últimos 7 meses · meta de{" "}
                  <span className="tabular-nums">{series.data.meta_sessoes}</span>/mês · taxa de
                  ocupação{" "}
                  <span className="tabular-nums">{series.data.ocupacao_percentual}%</span>
                </>
              ) : (
                <Skeleton className="h-2.5 w-64" />
              )
            }
          >
            <BarChart
              data={series.data?.sessoes ?? []}
              xKey="periodo"
              series={[{ key: "sessoes", label: "Sessões" }]}
              loading={series.isLoading}
              error={erroSeries}
              onRetry={recarregarSeries}
              altura={ALTURA_GRAFICO}
            />
          </ChartCard>

          <ChartCard titulo="Pacientes por CID" descricao="Distribuição atual">
            <DonutChart
              data={series.data?.pacientes_por_cid ?? []}
              totalLabel="pacientes"
              loading={series.isLoading}
              error={erroSeries}
              onRetry={recarregarSeries}
              altura={ALTURA_GRAFICO}
            />
          </ChartCard>

          <ChartCard
            largo
            titulo="Efeitos adversos por protocolo"
            descricao="% de pacientes com grau 2+ · pergunta levantada na reunião com a Dra."
          >
            <BarChart
              data={series.data?.efeitos_por_protocolo ?? []}
              xKey="protocolo"
              series={SERIES_EFEITOS}
              sufixo="%"
              legenda
              loading={series.isLoading}
              error={erroSeries}
              onRetry={recarregarSeries}
              altura={ALTURA_GRAFICO}
            />
          </ChartCard>

          <ChartCard
            titulo="Engajamento ao longo das semanas"
            descricao="% de pacientes ativos no app"
          >
            <LineChart
              data={series.data?.engajamento ?? []}
              xKey="periodo"
              series={[{ key: "engajamento", label: "Ativos no app" }]}
              sufixo="%"
              loading={series.isLoading}
              error={erroSeries}
              onRetry={recarregarSeries}
              altura={ALTURA_GRAFICO}
            />
          </ChartCard>
        </div>

        {/* ----------------------------------------------------------- nota */}
        <p className="text-muted-foreground text-[11px] leading-relaxed">
          Todos os dados são <strong className="text-foreground font-medium">anonimizados</strong> e
          agregados — nenhum registro individual identificável é mostrado neste dashboard.
        </p>
      </div>
    </div>
  );
}

export default DashboardPage;
