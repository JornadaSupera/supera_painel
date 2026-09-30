import { Gauge, MailCheck, MessageSquareText, Star } from "lucide-react";
import { useState } from "react";

import {
  BarChart,
  ChartCard,
  DataTable,
  EmptyState,
  ErrorState,
  Footnote,
  PageHeader,
  SkeletonCards,
  SkeletonChart,
  StatCard,
  type Column,
} from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, pluralize } from "@/lib/format";
import { SMALL_BASE } from "@/lib/nps";
import type { MilestoneSummary } from "@/types/satisfaction";
import { SatisfactionAnswers } from "../components/SatisfactionAnswers";
import { EMPTY_FILTERS, useSatisfactionSummary, type AnswerFilters } from "../hooks/useSatisfaction";

/**
 * Satisfação dos pacientes — a pesquisa NPS que o aplicativo abre nos marcos da
 * jornada, com as notas e os comentários.
 *
 * Não está no protótipo nem no Mapa de Requisitos: é uma tela pedida pela clínica
 * depois do contrato. Segue a linguagem visual das Estatísticas.
 *
 * > [!] Quem lê, e o que a tela não faz
 * Nota e comentário só a administração lê; não há política para profissional em
 * nenhuma das duas tabelas, então esta tela não tem versão clínica. O nome do
 * paciente não aparece: a resposta é atribuível, e o nome se lê na ficha, onde o
 * acesso fica registrado.
 *
 * > [!] O que "período" quer dizer aqui
 * Nota, distribuição, evolução e lista contam as respostas DADAS no período. A
 * taxa de resposta conta as pesquisas ABERTAS no período e quantas já foram
 * respondidas — outro conjunto, de propósito: uma pesquisa aberta mês passado e
 * respondida hoje entra na nota de hoje e na taxa do mês passado.
 */

const PERIODS: { value: string; label: string; days: number | null }[] = [
  { value: "30", label: "Últimos 30 dias", days: 30 },
  { value: "90", label: "Últimos 90 dias", days: 90 },
  { value: "180", label: "Últimos 180 dias", days: 180 },
  { value: "365", label: "Último ano", days: 365 },
  { value: "all", label: "Todo o período", days: null },
];

const PAGE_SIZE_DEFAULT = 10;

/** "2026-09" → "set/2026". */
function monthLabel(month: string): string {
  return new Date(`${month}-15T12:00:00Z`)
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .replace(".", "")
    .replace(" de ", "/");
}

export function SatisfacaoPage() {
  const [period, setPeriod] = useState("90");
  const [filters, setFilters] = useState<AnswerFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);

  const days = PERIODS.find((item) => item.value === period)?.days ?? null;
  const summary = useSatisfactionSummary(days);
  const data = summary.data;

  const columns: Column<MilestoneSummary>[] = [
    {
      key: "label",
      header: "Momento da jornada",
      width: "36%",
      render: (row) => <span className="text-sm font-medium">{row.label}</span>,
    },
    {
      key: "sent",
      header: "Pesquisas abertas",
      align: "right",
      mono: true,
      render: (row) => <span className="text-xs">{formatNumber(row.sent)}</span>,
    },
    {
      key: "answered",
      header: "Já respondidas",
      align: "right",
      mono: true,
      render: (row) => <span className="text-xs">{formatNumber(row.answered)}</span>,
    },
    {
      key: "responses",
      header: "Respostas no período",
      align: "right",
      mono: true,
      render: (row) => <span className="text-xs">{formatNumber(row.responses)}</span>,
    },
    {
      key: "nps",
      header: "NPS",
      align: "right",
      mono: true,
      render: (row) => <span className="text-xs">{row.nps === null ? "—" : formatNumber(row.nps)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Qualidade"
        title="Satisfação dos pacientes"
        subtitle="Pesquisa NPS aberta nos marcos da jornada · notas e comentários"
        actions={
          <Select
            value={period}
            onValueChange={(value) => {
              setPeriod(value);
              setPage(1);
            }}
          >
            <SelectTrigger size="sm" aria-label="Período" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {summary.isLoading && (
        <>
          <SkeletonCards count={4} />
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        </>
      )}

      {summary.isError && <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />}

      {data && (
        <>
          {data.partial && (
            <Alert role="status">
              <AlertTitle>Leitura limitada</AlertTitle>
              <AlertDescription>
                O período tem mais respostas do que a tela lê de uma vez. Os números abaixo cobrem só uma
                parte; estreite o período para ver o recorte inteiro.
              </AlertDescription>
            </Alert>
          )}

          {data.surveys_sent === 0 && data.responses === 0 ? (
            <EmptyState
              title="Nenhuma pesquisa neste período"
              description="A pesquisa abre sozinha no primeiro acesso do paciente ao aplicativo. Quando houver pesquisas abertas ou respondidas neste período, os números aparecem aqui."
            />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="NPS"
                  value={data.nps === null ? "—" : data.nps}
                  context="promotores menos detratores"
                  icon={<Gauge size={16} />}
                  accent="bg-supera-amor/10 text-supera-amor"
                />
                <StatCard
                  label="Nota média"
                  value={data.average === null ? "—" : formatNumber(data.average, { minimumFractionDigits: 1 })}
                  context="de 0 a 10"
                  icon={<Star size={16} />}
                  accent="bg-supera-uniao/10 text-supera-uniao"
                />
                <StatCard
                  label="Respostas"
                  value={data.responses}
                  context={`${data.promoters} promotores · ${data.passives} neutros · ${data.detractors} detratores`}
                  icon={<MessageSquareText size={16} />}
                  accent="bg-primary/10 text-primary"
                />
                <StatCard
                  label="Taxa de resposta"
                  value={data.response_rate === null ? "—" : data.response_rate}
                  unit={data.response_rate === null ? undefined : "%"}
                  context={`${data.surveys_answered} de ${pluralize(data.surveys_sent, "pesquisa aberta", "pesquisas abertas")}`}
                  icon={<MailCheck size={16} />}
                  accent="bg-supera-esperanca/10 text-supera-esperanca"
                />
              </div>

              {data.responses === 0 && (
                <Alert role="status">
                  <AlertTitle>Nenhuma pesquisa respondida ainda</AlertTitle>
                  <AlertDescription>
                    Foram abertas {pluralize(data.surveys_sent, "pesquisa", "pesquisas")} neste período e
                    nenhuma teve resposta. Sem resposta não há nota, e a tela não mostra zero no lugar.
                  </AlertDescription>
                </Alert>
              )}

              {data.responses > 0 && data.responses < SMALL_BASE && (
                <Alert role="status">
                  <AlertTitle>Base pequena</AlertTitle>
                  <AlertDescription>
                    Com {pluralize(data.responses, "resposta", "respostas")}, uma única pessoa muda o NPS em
                    dezenas de pontos. Leia o número como indício, não como tendência.
                  </AlertDescription>
                </Alert>
              )}

              {data.responses > 0 && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Distribuição das notas" description="Quantas respostas deram cada nota, de 0 a 10">
                    <BarChart
                      data={data.distribution.map((item) => ({ nota: String(item.score), respostas: item.count }))}
                      xKey="nota"
                      series={[{ key: "respostas", label: "Respostas" }]}
                      height={220}
                    />
                  </ChartCard>

                  <ChartCard title="NPS por mês" description="Promotores menos detratores entre as respostas de cada mês">
                    <BarChart
                      data={data.by_month.map((item) => ({
                        mes: monthLabel(item.month),
                        nps: item.nps ?? 0,
                        respostas: item.responses,
                      }))}
                      xKey="mes"
                      series={[{ key: "nps", label: "NPS" }]}
                      height={220}
                    />
                  </ChartCard>
                </div>
              )}

              <section className="flex flex-col gap-3" aria-labelledby="satisfaction-milestones">
                <h2 id="satisfaction-milestones" className="text-sm font-semibold">
                  Por momento da jornada
                </h2>
                <div className="bg-card overflow-hidden rounded-2xl border">
                  <DataTable
                    columns={columns}
                    data={data.by_milestone}
                    getRowId={(row) => row.code}
                    caption="Pesquisas abertas, respondidas e NPS por momento da jornada"
                    label="momentos"
                    density="compact"
                  />
                </div>
              </section>
            </>
          )}

          <SatisfactionAnswers
            days={days}
            milestones={data.by_milestone.map((item) => ({ code: item.code, label: item.label }))}
            filters={filters}
            onFiltersChange={(next) => {
              setFilters(next);
              setPage(1);
            }}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />

          <Footnote>
            NPS é a porcentagem de promotores (notas 9 e 10) menos a de detratores (notas de 0 a 6). Só a
            administração lê as respostas; o nome do paciente fica na ficha.
          </Footnote>
        </>
      )}
    </div>
  );
}

export default SatisfacaoPage;
