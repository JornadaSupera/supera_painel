import { pluralize } from "@/lib/format";
import {
  failWith,
  ok,
  okOne,
  type FailResult,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type { CruzamentoClinico, EstatisticasOperacionais } from "@/types/estatisticas";
import type { DefinicaoRelatorio, ResultadoRelatorio } from "@/types/relatorio";
import type { SatisfactionSummary } from "@/types/satisfaction";
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
  cruzamento: SingleResult<CruzamentoClinico>,
): ReportOutcome {
  if (cruzamento.error) return failWith(cruzamento.error);

  const dados = cruzamento.data;
  const grau = dados?.grau_minimo ?? 2;

  /*
   * O relatório segue a medida do cruzamento, e não o contrário.
   *
   * Com denominador, a coluna que ordena é a prevalência. Sem ele, publicar uma
   * coluna "Prevalência (%)" preenchida com `?? 0` daria a um relatório
   * exportável — que sai da clínica em PDF e em CSV — uma coluna de zeros com
   * cara de medição. Aí a medida é o registro, que é exato, e o cabeçalho diz
   * isso.
   */
  const porPercentual = dados?.prevalencia_disponivel ?? true;

  const colunasBase = [
    { key: "protocolo", label: "Protocolo" },
    { key: "efeito", label: "Efeito adverso" },
  ];

  const linhas = (dados?.celulas ?? [])
    .filter((celula) => (porPercentual ? celula.pacientes_com > 0 : celula.registros > 0))
    .map((celula) => ({
      protocolo: celula.protocolo,
      efeito: celula.sintoma_label,
      pacientes: celula.pacientes_com,
      base: celula.pacientes_total ?? "",
      prevalencia: celula.percentual ?? 0,
      registros: celula.registros,
    }));

  const pacientesLabel = dados?.celulas.every((celula) => celula.pacientes_exato)
    ? "Pacientes"
    : "Pacientes (mínimo)";

  /*
   * O cabeçalho conta a mesma coisa que a tabela. `pacientes_considerados` é
   * `null` quando a origem não devolve o total de pacientes do recorte, e
   * `?? 0` transformava "não sei" em "0 pacientes" sobre uma tabela com
   * pacientes. Sem o total, o cabeçalho conta os registros, que é o que a
   * origem sabe — o mesmo texto que a tela de Estatísticas clínicas usa.
   */
  const considerados =
    dados?.pacientes_considerados == null
      ? pluralize(dados?.registros_considerados ?? 0, "registro", "registros")
      : pluralize(dados.pacientes_considerados, "paciente", "pacientes");

  return {
    slug: "efeitos-por-protocolo",
    titulo: "Efeitos adversos por protocolo e grau",
    colunas: porPercentual
      ? [
          ...colunasBase,
          { key: "pacientes", label: pacientesLabel, numerica: true },
          { key: "base", label: "No protocolo", numerica: true },
          { key: "prevalencia", label: "Prevalência (%)", numerica: true },
        ]
      : [
          ...colunasBase,
          { key: "registros", label: "Registros", numerica: true },
          { key: "pacientes", label: pacientesLabel, numerica: true },
        ],
    linhas: porPercentual
      ? [...linhas].sort((a, b) => b.prevalencia - a.prevalencia)
      : [...linhas].sort((a, b) => b.registros - a.registros),
    // O período fica por conta do cabeçalho da tela, que já o diz: repeti-lo aqui
    // dava "Últimos 30 dias · … · últimos 30 dias".
    resumo: porPercentual
      ? `grau ${grau} ou maior · ${considerados}`
      : `grau ${grau} ou maior · ${considerados} · prevalência indisponível: a origem não devolve o total de pacientes por protocolo`,
    eixo: "efeito",
    medida: porPercentual ? "prevalencia" : "registros",
  };
}

/**
 * Report 10 — patient satisfaction (NPS), by moment of the journey.
 *
 * It reads the same summary the Satisfação screen shows, so the two can never
 * disagree. Only totals leave here: no comment and no patient, which is why the
 * report can be exported where the answers themselves cannot.
 */
export function npsReport(summary: SingleResult<SatisfactionSummary>, dias: number): ReportOutcome {
  if (summary.error) return failWith(summary.error);

  const dados = summary.data;
  const dash = "—";

  // Every row opens the answers behind it, on the same period.
  const linha = (
    momento: string,
    abertas: number,
    respondidas: number,
    respostas: number,
    nps: number | null,
    codigo?: string,
  ) => ({
    momento,
    abertas,
    respondidas,
    respostas,
    nps: nps ?? dash,
    _destino: `/satisfacao?dias=${dias}${codigo ? `&momento=${codigo}` : ""}`,
  });

  const linhas = dados
    ? [
        ...dados.by_milestone.map((item) =>
          linha(item.label, item.sent, item.answered, item.responses, item.nps, item.code),
        ),
        linha("Todos os momentos", dados.surveys_sent, dados.surveys_answered, dados.responses, dados.nps),
      ]
    : [];

  const resumo = !dados
    ? "sem dados"
    : dados.responses === 0
      ? `${pluralize(dados.surveys_sent, "pesquisa aberta", "pesquisas abertas")}, nenhuma respondida ainda`
      : `${pluralize(dados.responses, "resposta", "respostas")} · NPS ${dados.nps ?? dash} · nota média ${dados.average ?? dash}${dados.response_rate === null ? "" : ` · ${dados.response_rate}% das pesquisas abertas respondidas`}`;

  return {
    slug: "nps",
    titulo: "Satisfação do paciente (NPS)",
    colunas: [
      { key: "momento", label: "Momento da jornada" },
      { key: "abertas", label: "Pesquisas abertas", numerica: true },
      { key: "respondidas", label: "Já respondidas", numerica: true },
      { key: "respostas", label: "Respostas no período", numerica: true },
      { key: "nps", label: "NPS", numerica: true },
    ],
    linhas,
    resumo,
    eixo: "momento",
    medida: "respostas",
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
      resumo: `${pluralize(linhas.reduce((soma, linha) => soma + linha.volume, 0), "compromisso", "compromissos")} no período`,
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
    resumo: "motivos de falta indisponíveis: o catálogo de motivos ainda está vazio",
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
      { key: "valor", label: "Tempo médio de resposta", numerica: true, unidade: "min" },
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

/**
 * A ranked row of "Conteúdo mais acessado": one published orientação.
 *
 * The index signature is what lets this sit in `ResultadoRelatorio.linhas`
 * (`Record<string, string | number>[]`) — every other report builds that
 * shape as an inline object literal, which TypeScript accepts structurally;
 * a named interface needs the signature spelled out.
 */
export interface ContentReadRow {
  [key: string]: string | number;
  titulo: string;
  area: string;
  leituras: number;
}

/**
 * Ranking of most-read published content.
 *
 * Sorts here, not at the call site: the adapter's raw rows come pre-sorted
 * from `summarize_content_reads` (`ORDER BY count DESC`), but the merge step
 * that attaches titles and drops confidential/unpublished items can change
 * that order, and a report whose ranking silently stops matching its own
 * numbers is worse than one that pays a redundant sort.
 */
export function contentReadsReport(
  linhas: ContentReadRow[],
  dias: number,
  semVersaoPublicada: number,
): ResultadoRelatorio {
  const ordenadas = [...linhas].sort((a, b) => b.leituras - a.leituras);
  const totalLeituras = ordenadas.reduce((soma, linha) => soma + linha.leituras, 0);

  return {
    slug: "conteudo-mais-acessado",
    titulo: "Conteúdo mais acessado",
    colunas: [
      { key: "titulo", label: "Orientação" },
      { key: "area", label: "Área" },
      { key: "leituras", label: "Leituras", numerica: true },
    ],
    linhas: ordenadas,
    resumo:
      `${pluralize(totalLeituras, "leitura", "leituras")} nos últimos ${dias} dias · ${pluralize(ordenadas.length, "orientação", "orientações")} no ranking` +
      (semVersaoPublicada > 0
        ? ` · ${semVersaoPublicada} com leitura registrada mas sem versão publicada no momento, fora do ranking`
        : ""),
    eixo: "titulo",
    medida: "leituras",
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
        dados.colunas.map((coluna) => [
          coluna.unidade === "min" ? `${coluna.label} (min)` : coluna.label,
          String(linha[coluna.key] ?? ""),
        ]),
      ),
    ),
  );
}

export interface ReportParams {
  slug: string;
  dias?: number;
  /** Panel-side specialty code. Ignored by reports that do not declare the filter. */
  especialidade?: string | null;
}

/**
 * Everything around `run` that does not depend on the backend: the export and
 * the delivery operations. `export` is a reserved word, so the adapter
 * publishes `exportar` under the contract name.
 *
 * `logExport` is how the Supabase adapter declares the export to
 * `log_data_export` (25/09/2026) without this shared file touching the SDK
 * directly — the architecture guard restricts `@supabase/supabase-js` to
 * `services/adapters/supabase`. The mock adapter passes nothing: there is no
 * trail to write to.
 */
export function createReportOperations(
  run: (params: ReportParams) => Promise<SingleResult<ResultadoRelatorio>>,
  logExport?: (params: { slug: string; rowCount: number; format?: "pdf" }) => void | Promise<void>,
) {
  return {
    exportar: async (params: ReportParams) => {
      const resultado = toReportExport(await run(params));
      if (!resultado.error) await logExport?.({ slug: params.slug, rowCount: resultado.data.length });
      return resultado;
    },

    registrarExportacao: async (params: {
      slug: string;
      linhas: number;
      formato: "pdf";
    }): Promise<SingleResult<null>> => {
      await logExport?.({ slug: params.slug, rowCount: params.linhas, format: params.formato });
      return okOne(null);
    },
  };
}
