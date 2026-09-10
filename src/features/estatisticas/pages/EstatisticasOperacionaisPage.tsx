import { Activity, CalendarX, Clock, MessageSquare } from "lucide-react";
import type { ComponentType } from "react";

import {
  BackendPendente,
  BarChart,
  ChartCard,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonCards,
  SkeletonChart,
  StatCard,
  type Column,
} from "@/components/shared";
import { formatNumber } from "@/lib/format";
import type { LinhaEspecialidade } from "@/types/estatisticas";
import { useEstatisticasOperacionais } from "../hooks/useEstatisticas";

/**
 * Estatísticas operacionais — a operação da clínica.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/estatisticas/operacionais/
 *
 * Onde nos afastamos do protótipo, e por quê:
 *
 *  - **Linhas de meta e capacidade no gráfico**: o protótipo desenha "meta
 *    320/mês" e "capacidade 380/mês". Não existe tabela de parâmetro
 *    operacional no banco; desenhar as linhas com números inventados faria a
 *    tela afirmar que a clínica bateu ou furou uma meta que ninguém definiu.
 *  - **Fila de alertas**: depende de uma tabela de alerta que não existe.
 *    Derivar "sintoma crítico" a partir do grau seria inferência clínica.
 *  - **Variação percentual nos indicadores**: o protótipo mostra "-3 min",
 *    "+12". Comparar com o período anterior exige uma segunda leitura que hoje
 *    dobraria a consulta; o número atual vai sem seta, que é melhor do que uma
 *    seta apontando para uma comparação que não foi feita.
 */

const ICONES: Record<string, ComponentType> = {
  tempo_resposta_chat: Clock,
  taxa_falta: CalendarX,
  atendimentos_semana: Activity,
  mensagens_dia: MessageSquare,
};

const MOTIVO_SEM_PARAMETRO =
  "Meta mensal e capacidade máxima não existem como dado: não há tabela de parâmetro operacional no banco. Assim que a clínica registrar os dois números, as linhas de referência aparecem no gráfico.";

const MOTIVO_SEM_ALERTAS =
  "A fila de alertas depende de uma tabela de alerta e de uma regra de criticidade, que o backend ainda não tem. Deduzir alerta a partir do grau do sintoma seria inferência clínica no painel, que o escopo não permite.";

export function EstatisticasOperacionaisPage() {
  const { data, isLoading, isError, error, refetch } = useEstatisticasOperacionais();

  const colunas: Column<LinhaEspecialidade>[] = [
    {
      key: "label",
      header: "Especialidade",
      width: "34%",
      render: (linha) => <span className="text-sm font-medium">{linha.label}</span>,
    },
    {
      key: "volume",
      header: "Volume",
      align: "right",
      mono: true,
      render: (linha) => <span className="text-xs">{formatNumber(linha.volume)}</span>,
    },
    {
      key: "faltas",
      header: "Faltas",
      align: "right",
      mono: true,
      render: (linha) => <span className="text-xs">{formatNumber(linha.faltas)}</span>,
    },
    {
      key: "cancelamentos",
      header: "Cancelamentos",
      align: "right",
      mono: true,
      render: (linha) => <span className="text-xs">{formatNumber(linha.cancelamentos)}</span>,
    },
    {
      key: "remarcacoes",
      header: "Remarcações",
      align: "right",
      mono: true,
      render: (linha) => <span className="text-xs">{formatNumber(linha.remarcacoes)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Estatísticas"
        title="Estatísticas operacionais"
        level="Médio"
        subtitle="Operação da clínica · volume, tempo de resposta e adesão à agenda"
      />

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {/* ------------------------------------------------------- indicadores */}
      {isLoading ? (
        <SkeletonCards count={4} />
      ) : (
        !isError && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(data?.indicadores ?? []).map((indicador) => {
              const Icone = ICONES[indicador.chave] ?? Activity;

              return (
                <StatCard
                  key={indicador.chave}
                  label={indicador.label}
                  // `null` quer dizer "não houve base para calcular" — sem
                  // conversa respondida não existe tempo médio de resposta, e
                  // um zero ali afirmaria atendimento instantâneo.
                  value={indicador.valor === null ? "—" : formatNumber(indicador.valor)}
                  unit={indicador.valor === null ? undefined : indicador.unidade}
                  context={indicador.valor === null ? "sem base no período" : indicador.contexto}
                  invertColor={indicador.inverter_cor}
                  icon={<Icone />}
                  level="medio"
                />
              );
            })}
          </div>
        )
      )}

      {/* ---------------------------------------------------- volume mensal */}
      <ChartCard title="Volume de sessões" description="Compromissos por mês nos últimos 7 meses">
        {isLoading ? (
          <SkeletonChart />
        ) : isError ? (
          // Sem este ramo o gráfico desenharia um eixo com barras zeradas, que
          // se lê como "a clínica não teve compromisso nenhum" — afirmação que
          // a consulta não chegou a apurar.
          <ErrorState compact error={error} />
        ) : (
          <BarChart
            data={data?.volume_mensal ?? []}
            xKey="mes"
            series={[{ key: "total", label: "Compromissos" }]}
            height={220}
          />
        )}
      </ChartCard>

      {(data?.sem_origem.length ?? 0) > 0 && (
        <BackendPendente titulo="Meta e capacidade" motivo={MOTIVO_SEM_PARAMETRO} />
      )}

      {/* ------------------------------------------------ por especialidade */}
      <section className="flex flex-col gap-3">
        <h2 className="text-foreground text-sm font-semibold">
          Atendimentos por especialidade
          <span className="text-muted-foreground font-normal"> · últimos 7 meses</span>
        </h2>

        <div className="bg-card overflow-hidden rounded-2xl border">
          <DataTable
            columns={colunas}
            data={data?.por_especialidade ?? []}
            getRowId={(linha) => linha.especialidade}
            caption="Volume de compromissos por especialidade, com faltas, cancelamentos e remarcações."
            label="especialidades"
            loading={isLoading}
            error={isError ? error : null}
            onRetry={() => void refetch()}
            emptyState={
              <EmptyState
                title="Nenhum compromisso com área de origem"
                description="Os compromissos do período não têm especialidade de origem registrada, então não há como distribuí-los por área."
              />
            }
          />
        </div>
      </section>

      <BackendPendente titulo="Fila de alertas" motivo={MOTIVO_SEM_ALERTAS} />
    </div>
  );
}

export default EstatisticasOperacionaisPage;
