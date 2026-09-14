import {
  ERROR_CODE,
  fail,
  failWith,
  ok,
  type FailResult,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type { CruzamentoClinico, EstatisticasOperacionais } from "@/types/estatisticas";
import type { DefinicaoRelatorio, ResultadoRelatorio } from "@/types/relatorio";
import { DEFINICOES } from "./relatoriosDefinicoes";

/**
 * REPORT ENGINE PIECES SHARED BY BOTH ADAPTERS.
 * =============================================================================
 * The catalog, the columns and the export shape are the same whichever backend
 * runs the report. Only where the numbers come from changes — and that stays
 * in each adapter.
 */

/** A finished report, or the failure that came from its data path. */
export type ReportOutcome = ResultadoRelatorio | FailResult;

export function isReportFailure(outcome: ReportOutcome): outcome is FailResult {
  return "error" in outcome && outcome.error !== null;
}

/**
 * The twelve definitions, each marked available or not.
 *
 * An unavailable report stays in the catalog with its reason: the set of
 * twelve is contracted, and hiding the card would hide what is still missing.
 */
export function listDefinitionsWithout(
  withoutSource: Record<string, string>,
): ListResult<DefinicaoRelatorio> {
  return ok(
    DEFINICOES.map((definicao) => {
      const motivo = withoutSource[definicao.slug];

      return motivo
        ? { ...definicao, disponivel: false, motivo }
        : { ...definicao, disponivel: true };
    }),
  );
}

function percentage(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

export function effectsByProtocolReport(
  dias: number,
  cruzamento: SingleResult<CruzamentoClinico>,
): ReportOutcome {
  if (cruzamento.error) return failWith(cruzamento.error);

  const dados = cruzamento.data;

  return {
    slug: "efeitos-por-protocolo",
    titulo: "Efeitos adversos por protocolo e grau",
    colunas: [
      { key: "protocolo", label: "Protocolo" },
      { key: "efeito", label: "Efeito adverso" },
      { key: "pacientes", label: "Pacientes", numerica: true },
      { key: "base", label: "No protocolo", numerica: true },
      { key: "prevalencia", label: "Prevalência (%)", numerica: true },
    ],
    linhas: (dados?.celulas ?? [])
      .filter((celula) => celula.pacientes_com > 0)
      .map((celula) => ({
        protocolo: celula.protocolo,
        efeito: celula.sintoma_label,
        pacientes: celula.pacientes_com,
        base: celula.pacientes_total,
        prevalencia: celula.percentual ?? 0,
      }))
      .sort((a, b) => b.prevalencia - a.prevalencia),
    resumo: `grau ${dados?.grau_minimo ?? 2} ou maior · ${dados?.pacientes_considerados ?? 0} pacientes · últimos ${dias} dias`,
    eixo: "efeito",
    medida: "prevalencia",
  };
}

export function bySpecialtyReport(
  slug: "faltas-cancelamentos" | "volume-por-especialidade",
  operacionais: SingleResult<EstatisticasOperacionais>,
): ReportOutcome {
  if (operacionais.error) return failWith(operacionais.error);

  const linhas = operacionais.data?.por_especialidade ?? [];

  if (slug === "volume-por-especialidade") {
    return {
      slug,
      titulo: "Volume de atendimento por especialidade",
      colunas: [
        { key: "especialidade", label: "Especialidade" },
        { key: "volume", label: "Atendimentos", numerica: true },
      ],
      linhas: linhas.map((linha) => ({ especialidade: linha.label, volume: linha.volume })),
      resumo: `${linhas.reduce((soma, linha) => soma + linha.volume, 0)} compromissos no período`,
      eixo: "especialidade",
      medida: "volume",
    };
  }

  return {
    slug,
    titulo: "Faltas, cancelamentos e remarcações",
    colunas: [
      { key: "especialidade", label: "Especialidade" },
      { key: "faltas", label: "Faltas", numerica: true },
      { key: "cancelamentos", label: "Cancelamentos", numerica: true },
      { key: "remarcacoes", label: "Remarcações", numerica: true },
      { key: "taxa_falta", label: "Taxa de falta (%)", numerica: true },
    ],
    // The no-show reason would go here, but the reasons catalog is empty on
    // purpose: the list of reasons does not exist in any source.
    linhas: linhas.map((linha) => ({
      especialidade: linha.label,
      faltas: linha.faltas,
      cancelamentos: linha.cancelamentos,
      remarcacoes: linha.remarcacoes,
      taxa_falta: percentage(linha.faltas, linha.volume),
    })),
    resumo: "motivos de falta indisponíveis: o catálogo de motivos está vazio no backend",
    eixo: "especialidade",
    medida: "faltas",
  };
}

export function chatResponseReport(
  operacionais: SingleResult<EstatisticasOperacionais>,
): ReportOutcome {
  if (operacionais.error) return failWith(operacionais.error);

  const indicador = operacionais.data?.indicadores.find(
    (item) => item.chave === "tempo_resposta_chat",
  );

  return {
    slug: "tempo-resposta-chat",
    titulo: "Tempo médio de resposta no chat",
    colunas: [
      { key: "indicador", label: "Indicador" },
      { key: "valor", label: "Minutos", numerica: true },
    ],
    linhas:
      indicador?.valor == null ? [] : [{ indicador: "Média da equipe", valor: indicador.valor }],
    // Breaking it down by professional would become an individual performance
    // ranking, which is not what operations needs to measure.
    resumo:
      "média da primeira resposta a cada conversa · o painel não abre por profissional, só por equipe",
    eixo: "indicador",
    medida: "valor",
  };
}

/** Engagement rows: people in treatment, how many engaged, and the rate. */
export function engagementRows(
  total: number,
  engaged: number,
  engagedLabel: string,
): Record<string, string | number>[] {
  return [
    { indicador: "Pacientes em tratamento", valor: total },
    { indicador: engagedLabel, valor: engaged },
    { indicador: "Taxa de engajamento (%)", valor: percentage(engaged, total) },
  ];
}

/** Flat report rows, keyed by column label, ready for CSV. */
function toReportExport(
  result: SingleResult<ResultadoRelatorio>,
): ListResult<Record<string, string>> {
  if (result.error) return failWith(result.error);

  const dados = result.data;
  if (!dados) return ok([]);

  return ok(
    dados.linhas.map((linha) =>
      Object.fromEntries(
        dados.colunas.map((coluna) => [coluna.label, String(linha[coluna.key] ?? "")]),
      ),
    ),
  );
}

/**
 * Scheduling and sharing have no backend.
 *
 * Scheduled e-mail delivery needs a scheduled routine and a sending service;
 * an internal share link needs a token table with expiry. Neither exists, and
 * both are ways clinical data leaves the clinic — not something to improvise
 * on the client.
 */
const NO_DELIVERY =
  "Agendar envio e gerar link compartilhável dependem de rotina agendada e de tabela de token no backend. Os dois fazem dado clínico sair da clínica, e por isso não são improvisados no painel.";

export interface ReportParams {
  slug: string;
  dias?: number;
}

/**
 * Everything around `run` that does not depend on the backend: the export and
 * the delivery operations. `export` is a reserved word, so the adapter
 * publishes `exportar` under the contract name.
 */
export function createReportOperations(
  run: (params: ReportParams) => Promise<SingleResult<ResultadoRelatorio>>,
) {
  return {
    exportar: async (params: ReportParams) => toReportExport(await run(params)),

    schedule: async (): Promise<SingleResult<never>> =>
      fail(ERROR_CODE.NOT_IMPLEMENTED, NO_DELIVERY),

    listSchedules: async (): Promise<ListResult<never>> => ok([]),

    createShareLink: async (): Promise<SingleResult<never>> =>
      fail(ERROR_CODE.NOT_IMPLEMENTED, NO_DELIVERY),
  };
}
