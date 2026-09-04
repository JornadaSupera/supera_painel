import { Activity, ShieldAlert, Star, TrendingUp, UserPlus, Users } from "lucide-react";
import { useRef, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import {
  BackendPendente,
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
import { formatLongDate, formatNumber } from "@/lib/format";
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

/** Indicadores que o protótipo mostra. */
const TOTAL_INDICADORES = 6;

const ALTURA_GRAFICO = 220;

/**
 * Por que cada gráfico pode não ter série.
 *
 * O texto é o motivo concreto, não "sem dados": um gráfico vazio porque a
 * clínica não teve movimento e um gráfico vazio porque o backend não agrega
 * são situações opostas, e a tela precisa distinguir as duas.
 */
const SEM_FONTE: Record<string, string> = {
  sessoes:
    "A agenda só se lê paciente a paciente. Enquanto o backend não expuser a agenda agregada, não há série de sessões a mostrar.",
  cid: "A distribuição por CID exigiria ler o diagnóstico de cada paciente individualmente — o que registraria um acesso a prontuário por linha do gráfico.",
  efeitos:
    "O cruzamento entre protocolo e efeito adverso ainda não existe como agregação no backend.",
  engajamento:
    "O engajamento vem do diário do paciente, que só se lê individualmente. Falta a agregação no backend.",
};

/**
 * Um gráfico só se desenha quando tem série.
 *
 * Recharts com um array vazio desenha eixos sem nada dentro, o que se lê como
 * "a clínica não teve movimento" — afirmação que este painel não pode fazer.
 * Na ausência de série, o cartão diz o motivo.
 */
function ComSerie({
  titulo,
  motivo,
  vazio,
  children,
}: {
  titulo: string;
  motivo: string;
  vazio: boolean;
  children: ReactNode;
}) {
  if (!vazio) return children;

  return <BackendPendente titulo={titulo} motivo={motivo} altura={ALTURA_GRAFICO} />;
}

export function DashboardPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mensal");
  const navigate = useNavigate();
  const areaCaptura = useRef<HTMLDivElement>(null);

  const kpis = useKpis(periodo);
  const series = useSeries(periodo);

  const erroSeries = series.isError ? series.error : null;

  // "Sem série" só é uma afirmação depois que a resposta chegou e não falhou.
  const semSerie = (linhas: unknown[] | undefined) =>
    !series.isLoading && !erroSeries && (linhas?.length ?? 0) === 0;

  const recarregarSeries = () => void series.refetch();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Painel executivo"
        title="Visão geral"
        level="MVP"
        subtitle={
          <>
            {formatLongDate(new Date().toISOString())} ·{" "}
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
            <ErrorState error={kpis.error} onRetry={() => void kpis.refetch()} compact />
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
                        value={formatNumber(kpi.valor)}
                        unit={kpi.unidade}
                        delta={kpi.variacao}
                        deltaUnit={kpi.variacao_unidade}
                        period={kpi.variacao_periodo}
                        context={kpi.contexto}
                        invertColor={kpi.inverter_cor}
                        icon={Icone ? <Icone /> : undefined}
                        accent={visual?.acento}
                        level={kpi.nivel}
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

              {/*
                O protótipo tem seis indicadores. Quando o backend em uso não
                alimenta todos, os que faltam são OMITIDOS pela camada de dados,
                não zerados — um cartão marcando zero afirmaria que a clínica não
                teve nenhuma sessão de quimioterapia no mês. O espaço que sobra
                diz o que falta.
              */}
              {!kpis.isLoading && (kpis.data?.kpis.length ?? 0) < TOTAL_INDICADORES && (
                <BackendPendente
                  className="sm:col-span-2 lg:col-span-3 xl:col-span-4"
                  motivo="Sessões de quimioterapia, engajamento no app, NPS e alertas de sintoma crítico ainda não têm agregação no backend. Os indicadores aparecem assim que ela existir."
                />
              )}
            </div>
          )}
        </section>

        {/* -------------------------------------------------------- gráficos */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard
            wide
            title="Sessões de quimioterapia"
            description={
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
            <ComSerie titulo="Sessões de quimioterapia" motivo={SEM_FONTE.sessoes!} vazio={semSerie(series.data?.sessoes)}>
              <BarChart
                data={series.data?.sessoes ?? []}
                xKey="periodo"
                series={[{ key: "sessoes", label: "Sessões" }]}
                loading={series.isLoading}
                error={erroSeries}
                onRetry={recarregarSeries}
                height={ALTURA_GRAFICO}
              />
            </ComSerie>
          </ChartCard>

          <ChartCard title="Pacientes por CID" description="Distribuição atual">
            <ComSerie titulo="Pacientes por CID" motivo={SEM_FONTE.cid!} vazio={semSerie(series.data?.pacientes_por_cid)}>
              <DonutChart
                data={(series.data?.pacientes_por_cid ?? []).map((fatia) => ({
                  name: fatia.nome,
                  value: fatia.valor,
                }))}
                totalLabel="pacientes"
                loading={series.isLoading}
                error={erroSeries}
                onRetry={recarregarSeries}
                height={ALTURA_GRAFICO}
              />
            </ComSerie>
          </ChartCard>

          <ChartCard
            wide
            title="Efeitos adversos por protocolo"
            description="% de pacientes com grau 2+ · pergunta levantada na reunião com a Dra."
          >
            <ComSerie titulo="Efeitos adversos por protocolo" motivo={SEM_FONTE.efeitos!} vazio={semSerie(series.data?.efeitos_por_protocolo)}>
              <BarChart
                data={series.data?.efeitos_por_protocolo ?? []}
                xKey="protocolo"
                series={SERIES_EFEITOS}
                suffix="%"
                legend
                loading={series.isLoading}
                error={erroSeries}
                onRetry={recarregarSeries}
                height={ALTURA_GRAFICO}
              />
            </ComSerie>
          </ChartCard>

          <ChartCard
            title="Engajamento ao longo das semanas"
            description="% de pacientes ativos no app"
          >
            <ComSerie titulo="Engajamento no app" motivo={SEM_FONTE.engajamento!} vazio={semSerie(series.data?.engajamento)}>
              <LineChart
                data={series.data?.engajamento ?? []}
                xKey="periodo"
                series={[{ key: "engajamento", label: "Ativos no app" }]}
                suffix="%"
                loading={series.isLoading}
                error={erroSeries}
                onRetry={recarregarSeries}
                height={ALTURA_GRAFICO}
              />
            </ComSerie>
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
