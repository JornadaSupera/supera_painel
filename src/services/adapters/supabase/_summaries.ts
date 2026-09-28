import { falhaDe, type ErroPostgrest } from "./_helpers";
import { getSupabaseClient } from "./client";

/**
 * A FAMÍLIA `summarize_*` — leitura em CONJUNTO, sem titular.
 * =============================================================================
 * Segunda família de funções do banco, com contrato diferente da `read_*`, e o
 * prefixo é a documentação:
 *
 * | Prefixo | Devolve | Identifica alguém |
 * |---|---|---|
 * | `read_*` | linhas sobre um paciente, paginadas, com teto | sim — a trilha registra o titular |
 * | `summarize_*` | só números e rótulos de catálogo | não |
 *
 * **Nenhum resumo devolve nome, CPF, `patient_id` nem id de registro clínico.**
 * É o que destrava as telas que somam sobre a clínica inteira sem que uma linha
 * de prontuário chegue ao navegador — e o que faz o painel pagar **uma** leitura
 * auditada onde a soma no cliente pagaria uma por paciente.
 *
 * Quatro regras valem para as três primeiras funções — agenda, chat e sintoma
 * por protocolo —, e todas mudam o que a tela mostra:
 *
 * 1. **A janela é obrigatória.** Varredura sem período é recusada pelo servidor:
 *    sem recorte não é relatório, é dump.
 * 2. **`p_granularity` aceita `day`, `week` ou `month`** — qualquer outro valor
 *    é recusado. Não há SQL dinâmico do outro lado.
 * 3. **Balde nulo é resultado, não resíduo.** Protocolo nulo conta os eventos de
 *    paciente sem plano terapêutico registrado, e enquanto o Gemed estiver
 *    desligado é a maioria. Especialidade nula é o compromisso de laboratório
 *    parceiro, que não tem profissional. Descartar essas linhas jogaria fora
 *    justamente o que o relatório de faltas mais precisa contar.
 * 4. **O sigilo vale dentro do agregado.** A administração não vê psicologia no
 *    recorte por especialidade nem no total — os números dela são menores que os
 *    da clínica inteira, por desenho.
 *
 * `summarize_content_reads` é a quarta, e só segue a regra 0 (nenhum dado de
 * paciente sai da função). As outras três não se aplicam: não tem balde nem
 * `p_granularity` — é uma soma por orientação, não uma série —, a janela é
 * OPCIONAL no servidor (`p_from`/`p_to` aceitam nulo e viram "desde sempre"),
 * e o sigilo de Psicologia não é filtrado dentro da função: ela soma
 * `patient_content_states` inteira, confidencial incluída. É por isso que
 * `resumirLeituraConteudo` sempre manda as duas datas quando o chamador quer
 * um recorte, e por isso que quem lê o retorno (`conteudos.ts`,
 * `relatorios.ts`) descarta a especialidade confidencial no cliente, não no
 * banco.
 */

/* -------------------------------------------------------------------------
   LINHAS DE RETORNO
   ------------------------------------------------------------------------- */

/** `summarize_appointments` — um balde por período × tipo × área × situação. */
export interface LinhaResumoAgenda {
  bucket_start: string;
  appointment_type_id: string | null;
  appointment_type_label: string | null;
  specialty_id: string | null;
  specialty_label: string | null;
  status_code: string | null;
  status_label: string | null;
  status_reason_id: string | null;
  status_reason_label: string | null;
  appointment_count: number;
  /** Distintos DENTRO do balde: não somar entre baldes, que recontaria gente. */
  patient_count: number;
  confirmed_count: number;
}

/** `summarize_chat_response_times` — um balde por período × área. */
export interface LinhaResumoChat {
  bucket_start: string;
  specialty_id: string | null;
  specialty_label: string | null;
  conversation_count: number;
  answered_count: number;
  /**
   * Conversas sem nenhuma mensagem de profissional na janela.
   *
   * Vem separado porque o indicador de tempo tem **viés de janela**: o recorte é
   * sobre a ABERTURA da conversa, então a aberta no fim do período e respondida
   * depois entra aqui. A janela mais recente sempre parece pior do que foi.
   */
  unanswered_count: number;
  first_response_avg_seconds: number | null;
  first_response_median_seconds: number | null;
  first_response_p90_seconds: number | null;
}

/** `summarize_symptoms_by_protocol` — um balde por protocolo × sintoma × grau. */
export interface LinhaResumoSintoma {
  protocol_name: string | null;
  symptom_id: string | null;
  symptom_label: string | null;
  grade: number;
  /** Registros de sintoma. **Soma limpo** entre graus e entre sintomas. */
  report_count: number;
  /**
   * Pacientes distintos NAQUELE grau.
   *
   * Não soma entre graus: quem relatou grau 2 num dia e grau 3 noutro aparece
   * nos dois baldes, e somar contaria a mesma pessoa duas vezes.
   */
  patient_count: number;
  /**
   * O DENOMINADOR — desde 25/09/2026. Pacientes com plano daquele protocolo
   * vigente em algum ponto da janela, sob os mesmos filtros de CID e de ficha
   * ativa. `null` no balde de protocolo nulo: "sem plano" não é um conjunto
   * que a janela delimite, e dividir ali inventaria uma prevalência.
   */
  protocol_patient_count: number | null;
  /**
   * Pacientes distintos cujo PIOR grau na janela é ≥ o grau desta linha —
   * desde 25/09/2026. É o número certo para "grau 2 ou maior": somar
   * `patient_count` entre graus contaria duas vezes quem oscilou entre eles.
   */
  patients_at_or_above: number;
}

/**
 * `summarize_content_reads` — uma linha por orientação já lida.
 *
 * Sem balde: é soma total no recorte, não série no tempo. Item nunca lido não
 * aparece — não há linha de zero.
 */
export interface LinhaResumoLeituraConteudo {
  content_item_id: string;
  read_count: number;
}

export type Granularidade = "day" | "week" | "month";

/* -------------------------------------------------------------------------
   JANELAS
   ------------------------------------------------------------------------- */

export interface Janela {
  from: string;
  to: string;
}

/**
 * Do primeiro dia do mês de `meses - 1` atrás até agora.
 *
 * O limite superior é o instante atual, não o fim do mês: compromisso marcado
 * para semana que vem existe na agenda, e contá-lo como volume realizado faria
 * o mês corrente aparecer cheio antes de acontecer.
 */
export function janelaDeMeses(meses: number): Janela {
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth() - (meses - 1), 1, 0, 0, 0, 0);

  return { from: inicio.toISOString(), to: agora.toISOString() };
}

/** Os últimos `dias` dias corridos, terminando agora. */
export function janelaDeDias(dias: number): Janela {
  const agora = new Date();
  return { from: new Date(agora.getTime() - dias * 86_400_000).toISOString(), to: agora.toISOString() };
}

/** A mesma janela em `date`, que é o que `summarize_symptoms_by_protocol` recebe. */
export function comoDatas(janela: Janela): { from: string; to: string } {
  return { from: janela.from.slice(0, 10), to: janela.to.slice(0, 10) };
}

/**
 * `"2026-03-01"` → `"mar/26"`.
 *
 * `bucket_start` já vem truncado em `America/Sao_Paulo` pelo banco — é `date`,
 * não instante. Interpretar ao meio-dia UTC evita que o fuso do navegador
 * empurre o rótulo para o mês anterior.
 */
export function rotuloDoMes(bucketStart: string): string {
  return new Date(`${bucketStart}T12:00:00Z`)
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .replace(".", "");
}

/** Quantas semanas a janela cobre — denominador de "atendimentos por semana". */
export function semanasDa(janela: Janela): number {
  const dias = (Date.parse(janela.to) - Date.parse(janela.from)) / 86_400_000;
  return Math.max(1, dias / 7);
}

/* -------------------------------------------------------------------------
   CHAMADAS
   ------------------------------------------------------------------------- */

/** Uma leitura de resumo: as linhas, ou a falha já no formato do contrato. */
export type Resumo<T> = { linhas: T[] } | ReturnType<typeof falhaDe>;

export function falhou<T>(resumo: Resumo<T>): resumo is ReturnType<typeof falhaDe> {
  return !("linhas" in resumo);
}

async function chamar<T>(nome: string, argumentos: Record<string, unknown>): Promise<Resumo<T>> {
  const { data, error } = await getSupabaseClient().rpc(nome, argumentos);

  if (error) return falhaDe(error as ErroPostgrest);
  return { linhas: (data ?? []) as T[] };
}

export function resumirAgenda(params: {
  janela: Janela;
  granularidade?: Granularidade;
  especialidadeId?: string | null;
  tipoId?: string | null;
}): Promise<Resumo<LinhaResumoAgenda>> {
  return chamar<LinhaResumoAgenda>("summarize_appointments", {
    p_from: params.janela.from,
    p_to: params.janela.to,
    p_granularity: params.granularidade ?? "month",
    p_specialty_id: params.especialidadeId ?? null,
    p_appointment_type_id: params.tipoId ?? null,
  });
}

export function resumirChat(params: {
  janela: Janela;
  granularidade?: Granularidade;
  especialidadeId?: string | null;
}): Promise<Resumo<LinhaResumoChat>> {
  return chamar<LinhaResumoChat>("summarize_chat_response_times", {
    p_from: params.janela.from,
    p_to: params.janela.to,
    p_granularity: params.granularidade ?? "month",
    p_specialty_id: params.especialidadeId ?? null,
  });
}

export function resumirSintomas(params: {
  janela: Janela;
  protocolo?: string | null;
  sintomaId?: string | null;
  /** Código do CID-10 — desde 25/09/2026 (`create_panel_summaries`). */
  cid?: string | null;
  /** Recorta pela SITUAÇÃO DA FICHA HOJE — desde 25/09/2026. Padrão: só ativos. */
  apenasAtivos?: boolean;
}): Promise<Resumo<LinhaResumoSintoma>> {
  const datas = comoDatas(params.janela);

  return chamar<LinhaResumoSintoma>("summarize_symptoms_by_protocol", {
    p_from: datas.from,
    p_to: datas.to,
    p_protocol: params.protocolo ?? null,
    p_symptom_id: params.sintomaId ?? null,
    p_cid10_code: params.cid ?? null,
    p_active_only: params.apenasAtivos ?? true,
  });
}

/**
 * Sem `janela`, soma o acervo inteiro desde sempre — é o que a coluna
 * "Acessos" de `conteudos.list` mostra (histórico acumulado, ver
 * `contagemDeLeituras` em `./conteudos`). Com `janela`, soma só o recorte —
 * é o que o relatório "Conteúdo mais acessado" precisa (ver
 * `conteudoMaisAcessado` em `./relatorios`). A mesma função de banco serve às
 * duas perguntas; o que muda é só o argumento.
 */
export function resumirLeituraConteudo(janela?: Janela): Promise<Resumo<LinhaResumoLeituraConteudo>> {
  const datas = janela ? comoDatas(janela) : { from: null, to: null };

  return chamar<LinhaResumoLeituraConteudo>("summarize_content_reads", {
    p_from: datas.from,
    p_to: datas.to,
  });
}

/* -------------------------------------------------------------------------
   VOCABULÁRIO DOS BALDES
   ------------------------------------------------------------------------- */

/**
 * Situações terminais de `appointment_statuses.code`.
 *
 * `scheduled` é a quinta e fica de fora dos recortes de falta e cancelamento:
 * compromisso ainda por acontecer não é adesão nem ausência.
 */
export const SITUACAO = {
  REALIZADO: "completed",
  CANCELADO: "cancelled",
  FALTA: "no_show",
  REMARCADO: "rescheduled",
} as const;

/** Chave de linha para o balde sem área de origem — ver a regra 3 do topo. */
export const SEM_AREA = "sem-area";

/** Rótulo do balde nulo. Rotular é o oposto de descartar. */
export const SEM_AREA_LABEL = "Sem área de origem";

/** Rótulo do balde de evento sem plano terapêutico vigente na data. */
export const SEM_PROTOCOLO_LABEL = "Sem plano terapêutico";
