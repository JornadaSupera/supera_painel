import { pluralize } from "@/lib/format";
import { FASE_TRATAMENTO_LABEL } from "@/lib/enums";
import { ERROR_CODE, fail, ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type {
  AgendamentoRelatorio,
  AgendamentoRelatorioEntrada,
  DefinicaoRelatorio,
  ExecucaoRelatorio,
  FrequenciaRelatorio,
  ResultadoRelatorio,
} from "@/types/relatorio";
import {
  bySpecialtyReport,
  chatResponseReport,
  contentReadsReport,
  createReportOperations,
  effectsByProtocolReport,
  isReportFailure,
  listDefinitionsWithout,
  type ContentReadRow,
  type ReportOutcome,
  type ReportParams,
} from "../_reports";
import { TETO_READ, executar, falhaDe, logarExportacao, umDe } from "./_helpers";
import {
  SITUACAO,
  falhou,
  janelaDeDias,
  resumirAgenda,
  resumirLeituraConteudo,
  rotuloDoMes,
} from "./_summaries";
import { getSupabaseClient } from "./client";
import { crossTab } from "./estatisticasClinicas";
import { getIndicadores } from "./estatisticasOperacionais";
import { paraEspecialidade } from "./mapping";
import { varrerLista } from "./pacientes";

/**
 * Relatórios — o motor dos doze.
 *
 * Um motor, doze definições. A alternativa seria doze páginas parecidas, e então
 * doze lugares para corrigir a mesma coluna mal formatada.
 *
 * Cada relatório é uma função que devolve colunas descritas e linhas achatadas.
 * A tela não sabe de qual tabela o número veio — desenha o que recebe —, o que é
 * o que permite um relatório trocar de origem sem a tela mudar. Foi o que
 * aconteceu nesta rodada: **nove dos doze passaram a rodar** e nenhuma linha da
 * tela mudou junto.
 *
 * > [!] O que destravou, e o que continua fora
 * A família `summarize_*` deu ao painel a leitura em conjunto que faltava —
 * contagem somada no banco, sem linha de prontuário no navegador —, e
 * `read_patient_list` deu busca, filtro, total e — desde `rework_patient_list`,
 * 25/09/2026 — data de cadastro à listagem. Com as duas, agenda, chat, diário,
 * protocolo, fase, CID, cadastro e biblioteca de conteúdo passaram a ter fonte.
 * `read_patients`, a função antiga, foi removida na mesma migration; nenhum
 * relatório a usa mais.
 *
 * Os três que sobram não esperam leitura nenhuma: esperam **definição**. Cada
 * um diz o seu motivo no próprio cartão, porque o conjunto de doze é contratado
 * e sumir com o cartão esconderia o que falta entregar.
 */

/** Teto de varredura da base para os relatórios que contam pacientes. */
const TETO_VARREDURA = TETO_READ * 10;

/**
 * O QUE CONTINUA SEM ORIGEM — e por quê.
 * =============================================================================
 * Nenhum dos três é limitação de leitura. Tirar um slug desta lista sem que a
 * definição exista publica um número calculado sobre critério inventado, que é
 * pior do que um cartão que diz o que falta.
 */
const SEM_ORIGEM: Record<string, string> = {
  "alertas-ia":
    "A fila de alertas existe no backend, mas ainda não há um resumo de volume, tempo até conduta e desfecho que não identifique paciente. Sem gatilho de criticidade cadastrado em Configurações → Gatilhos de alerta, além disso, nenhum alerta dispara. Fila priorizada por IA é do nível Completo — fora do escopo contratado.",
  nps: "As tabelas e a função da pesquisa existem, mas nenhuma pesquisa é aberta: a rotina agendada que dispara o NPS não foi criada, e dois dos três marcos dependem do plano terapêutico, que só a integração com o Gemed preenche. Sem pesquisa aberta não há resposta para contar.",
  "engajamento-app":
    "“Engajamento” não tem definição em fonte nenhuma: sessões abertas, dias com registro no diário, orientações lidas e mensagens enviadas dariam quatro números diferentes, e o escopo não diz qual deles é o indicador. A pergunta está aberta com a clínica. Número calculado sobre definição inventada é pior que indicador ausente.",
};

export async function listDefinitions(): Promise<ListResult<DefinicaoRelatorio>> {
  return listDefinitionsWithout(SEM_ORIGEM);
}

/* -------------------------------------------------------------------------
   RELATÓRIOS SOBRE A LISTAGEM DE PACIENTES
   ------------------------------------------------------------------------- */

/** O aviso de recorte parcial, para o resumo do relatório. */
function avisoDeParcial(total: number, lidos: number): string {
  return ` · CONTAGEM PARCIAL: a varredura leu ${lidos} das ${total} fichas do recorte, e os números abaixo cobrem só essa parte`;
}

/**
 * Pacientes ativos por protocolo e fase.
 *
 * A listagem devolve protocolo vigente e fase na mesma resposta, sem uma segunda
 * chamada por paciente — que é exatamente o que antes tornava este relatório
 * impossível sem sujar a trilha de auditoria com um acesso por ficha.
 */
async function pacientesAtivos(): Promise<ReportOutcome> {
  const varredura = await varrerLista(
    { filters: { status: "ativo" }, sort: { field: "nome", direction: "asc" } },
    TETO_VARREDURA,
  );

  if (!("itens" in varredura)) return varredura;

  const porChave = new Map<string, { protocolo: string; fase: string; total: number }>();

  for (const paciente of varredura.itens) {
    // "Sem plano terapêutico" é resultado, não resíduo: enquanto o Gemed
    // estiver desligado o plano só entra por RPC manual, e saber de quantos
    // pacientes ele falta é o que permite ler o resto do relatório.
    const protocolo = paciente.protocolo_nome === "—" ? "Sem plano terapêutico" : paciente.protocolo_nome;
    const fase = paciente.fase ? FASE_TRATAMENTO_LABEL[paciente.fase] : "Sem fase registrada";

    const chave = `${protocolo}\u0000${fase}`;
    const atual = porChave.get(chave) ?? { protocolo, fase, total: 0 };

    atual.total += 1;
    porChave.set(chave, atual);
  }

  const linhas = [...porChave.values()].sort((a, b) => b.total - a.total);

  return {
    slug: "pacientes-ativos",
    titulo: "Pacientes ativos em tratamento",
    colunas: [
      { key: "protocolo", label: "Protocolo" },
      { key: "fase", label: "Fase do tratamento" },
      { key: "total", label: "Pacientes", numerica: true },
    ],
    linhas,
    resumo:
      `${pluralize(varredura.itens.length, "paciente ativo", "pacientes ativos")}` +
      (varredura.parcial ? avisoDeParcial(varredura.total, varredura.itens.length) : ""),
    eixo: "protocolo",
    medida: "total",
  };
}

/**
 * Distribuição por CID.
 *
 * Conta o **diagnóstico principal**, que é o que a listagem devolve. Paciente
 * com mais de um CID registrado entra uma vez, pelo principal — e o cabeçalho
 * diz isso, porque "distribuição por CID" contando todos os diagnósticos daria
 * um total maior que a base e ninguém notaria.
 */
async function distribuicaoCid(): Promise<ReportOutcome> {
  const varredura = await varrerLista({}, TETO_VARREDURA);
  if (!("itens" in varredura)) return varredura;

  const porCid = new Map<string, { codigo: string; label: string; total: number }>();

  for (const paciente of varredura.itens) {
    if (!paciente.cid) continue;

    const atual = porCid.get(paciente.cid) ?? {
      codigo: paciente.cid,
      label: paciente.cid_descricao,
      total: 0,
    };

    atual.total += 1;
    porCid.set(paciente.cid, atual);
  }

  const linhas = [...porCid.values()].sort((a, b) => b.total - a.total);
  const comCid = linhas.reduce((soma, linha) => soma + linha.total, 0);

  return {
    slug: "distribuicao-cid",
    titulo: "Distribuição de pacientes por CID",
    colunas: [
      { key: "codigo", label: "CID-10" },
      { key: "label", label: "Diagnóstico" },
      { key: "total", label: "Pacientes", numerica: true },
    ],
    linhas,
    resumo:
      `${pluralize(linhas.length, "código", "códigos")} · ${comCid} de ${pluralize(varredura.itens.length, "ficha", "fichas")} com diagnóstico principal registrado` +
      (varredura.parcial ? avisoDeParcial(varredura.total, varredura.itens.length) : ""),
    eixo: "codigo",
    medida: "total",
  };
}

/**
 * Novos pacientes por mês.
 *
 * Usava `read_patients` porque `read_patient_list` ordenava por data de
 * cadastro sem devolver a coluna. `rework_patient_list` (25/09/2026)
 * acrescentou `created_at` à projeção — a mesma que `pacientesAtivos` e
 * `distribuicaoCid` já liam por `varrerLista` — e `read_patients` foi
 * removida na mesma migration. A troca também tira o teto de 200: a
 * varredura pagina até `TETO_VARREDURA`, como os outros dois relatórios desta
 * família.
 */
async function novosPacientes(dias: number): Promise<ReportOutcome> {
  const varredura = await varrerLista({}, TETO_VARREDURA);
  if (!("itens" in varredura)) return varredura;

  const desde = janelaDeDias(dias).from;
  const noPeriodo = varredura.itens.filter(
    (item): item is typeof item & { criado_em: string } =>
      item.criado_em !== null && item.criado_em >= desde,
  );

  const porMes = new Map<string, number>();
  for (const item of noPeriodo) {
    const chave = `${item.criado_em.slice(0, 7)}-01`;
    porMes.set(chave, (porMes.get(chave) ?? 0) + 1);
  }

  const linhas = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, total]) => ({ mes: rotuloDoMes(chave), total }));

  const total = linhas.reduce((soma, ponto) => soma + ponto.total, 0);

  return {
    slug: "novos-pacientes",
    titulo: "Novos pacientes no período",
    colunas: [
      { key: "mes", label: "Mês" },
      { key: "total", label: "Novos pacientes", numerica: true },
    ],
    linhas,
    resumo:
      `${pluralize(total, "cadastro", "cadastros")} nos últimos ${dias} dias` +
      (varredura.parcial ? avisoDeParcial(varredura.total, varredura.itens.length) : ""),
    eixo: "mes",
    medida: "total",
  };
}

/* -------------------------------------------------------------------------
   RELATÓRIOS SOBRE A AGENDA
   ------------------------------------------------------------------------- */

/**
 * Sessões de quimioterapia realizadas.
 *
 * O recorte é do tipo de compromisso, e o id vem de `appointment_types` — que é
 * catálogo, de leitura direta e sem pedágio. Filtrar por `code` no cliente
 * depois do resumo daria o mesmo número; filtrar no servidor deixa a trilha
 * dizendo que a varredura foi do tipo, não da agenda inteira.
 */
async function sessoesQuimioterapia(dias: number): Promise<ReportOutcome> {
  const tipos = await getSupabaseClient()
    .from("appointment_types")
    .select("id, label")
    .eq("code", "infusion")
    .limit(1);

  if (tipos.error) return falhaDe(tipos.error);

  const tipo = (tipos.data as { id: string; label: string }[])[0];
  if (!tipo) {
    return fail(
      ERROR_CODE.NOT_FOUND,
      "O catálogo de tipos de compromisso não tem o tipo de infusão, que é o recorte deste relatório.",
    );
  }

  const resumo = await resumirAgenda({ janela: janelaDeDias(dias), tipoId: tipo.id });
  if (falhou(resumo)) return resumo;

  const realizados = resumo.linhas.filter((linha) => linha.status_code === SITUACAO.REALIZADO);

  const porMes = new Map<string, number>();
  for (const linha of realizados) {
    porMes.set(linha.bucket_start, (porMes.get(linha.bucket_start) ?? 0) + linha.appointment_count);
  }

  const linhas = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([balde, total]) => ({ mes: rotuloDoMes(balde), total }));

  const total = linhas.reduce((soma, ponto) => soma + ponto.total, 0);

  return {
    slug: "sessoes-quimioterapia",
    titulo: "Sessões de quimioterapia realizadas",
    colunas: [
      { key: "mes", label: "Mês" },
      { key: "total", label: "Sessões realizadas", numerica: true },
    ],
    linhas,
    // A taxa de ocupação da sala de infusão exigiria capacidade instalada, que
    // não é dado do banco. O relatório traz o volume e não finge a taxa.
    resumo: `${pluralize(total, "sessão realizada", "sessões realizadas")} nos últimos ${dias} dias · taxa de ocupação da sala indisponível: a capacidade instalada não é dado do backend`,
    eixo: "mes",
    medida: "total",
  };
}

/* -------------------------------------------------------------------------
   RELATÓRIO SOBRE A BIBLIOTECA DE CONTEÚDO
   ------------------------------------------------------------------------- */

interface LinhaEspecialidadeConteudo {
  code: string;
  is_confidential: boolean;
}

interface LinhaCategoriaConteudo {
  label: string;
  specialties: LinhaEspecialidadeConteudo | LinhaEspecialidadeConteudo[] | null;
}

interface LinhaVersaoPublicada {
  content_item_id: string;
  title: string;
  content_items: {
    content_categories: LinhaCategoriaConteudo | LinhaCategoriaConteudo[] | null;
  } | null;
}

/**
 * Conteúdo mais acessado.
 *
 * `summarize_content_reads` devolve id e contagem, sem título nem área — soma
 * sobre `patient_content_states` inteira, sem que nenhuma leitura de paciente
 * chegue ao navegador. O título vem de uma segunda consulta, só para os ids
 * que voltaram, na VERSÃO PUBLICADA: é o texto que o paciente de fato leu.
 * Item cuja versão publicada já saiu do ar (arquivada, nunca republicada de
 * novo) fica fora do ranking — a leitura entra na contagem do resumo, mas não
 * há título para pôr na linha.
 *
 * Psicologia sai do ranking por desenho, como nos outros relatórios agregados
 * desta família (regra 4 de `_summaries.ts`) — só que aqui o filtro é daqui
 * mesmo: `summarize_content_reads` não distingue confidencial, soma tudo.
 */
async function conteudoMaisAcessado(
  dias: number,
  especialidade?: string | null,
): Promise<ReportOutcome> {
  const resumo = await resumirLeituraConteudo(janelaDeDias(dias));
  if (falhou(resumo)) return resumo;

  if (resumo.linhas.length === 0) return contentReadsReport([], dias, 0);

  const { data, error } = await getSupabaseClient()
    .from("content_versions")
    .select(
      "content_item_id, title, content_items ( content_categories ( label, specialties ( code, is_confidential ) ) )",
    )
    .eq("status", "published")
    .in(
      "content_item_id",
      resumo.linhas.map((linha) => linha.content_item_id),
    );

  if (error) return falhaDe(error);

  const porItem = new Map(
    (data as unknown as LinhaVersaoPublicada[]).map((linha) => [linha.content_item_id, linha]),
  );

  const linhas: ContentReadRow[] = [];
  let semVersaoPublicada = 0;

  for (const contagem of resumo.linhas) {
    const versao = porItem.get(contagem.content_item_id);
    if (!versao) {
      semVersaoPublicada += 1;
      continue;
    }

    const categoria = umDe(versao.content_items?.content_categories);
    const area = umDe(categoria?.specialties);

    if (area?.is_confidential) continue;
    if (especialidade && paraEspecialidade(area?.code) !== especialidade) continue;

    linhas.push({
      titulo: versao.title,
      area: categoria?.label ?? "Sem categoria",
      leituras: Number(contagem.read_count),
    });
  }

  return contentReadsReport(linhas, dias, semVersaoPublicada);
}

/* -------------------------------------------------------------------------
   EXECUÇÃO
   ------------------------------------------------------------------------- */

export async function run(params: ReportParams): Promise<SingleResult<ResultadoRelatorio>> {
  return executar(async () => {
    const dias = params.dias ?? 30;
    const motivo = SEM_ORIGEM[params.slug];

    if (motivo) return fail(ERROR_CODE.NOT_IMPLEMENTED, motivo);

    const executarRelatorio = async (): Promise<ReportOutcome> => {
      switch (params.slug) {
        case "pacientes-ativos":
          return pacientesAtivos();
        case "novos-pacientes":
          return novosPacientes(dias);
        case "distribuicao-cid":
          return distribuicaoCid();
        case "efeitos-por-protocolo":
          return effectsByProtocolReport(
            dias,
            await crossTab({ dias, grauMinimo: 2, apenasAtivos: true }),
          );
        case "sessoes-quimioterapia":
          return sessoesQuimioterapia(dias);
        /* Os três que aceitam o recorte por área — é o que a definição deles
           declara em `filtros`, e é de lá que a tela sabe oferecer o seletor. */
        case "faltas-cancelamentos":
        case "volume-por-especialidade":
          return bySpecialtyReport(
            params.slug,
            await getIndicadores({ dias, especialidade: params.especialidade }),
          );
        case "tempo-resposta-chat":
          return chatResponseReport(
            await getIndicadores({ dias, especialidade: params.especialidade }),
          );
        case "conteudo-mais-acessado":
          return conteudoMaisAcessado(dias, params.especialidade);
        default:
          return fail(ERROR_CODE.NOT_FOUND, `Relatório "${params.slug}" não existe no catálogo.`);
      }
    };

    const saida = await executarRelatorio();
    return isReportFailure(saida) ? saida : okOne(saida);
  });
}

/**
 * Identificador estável para um relatório, fora do banco: nem `log_data_export`
 * nem `report_schedules` aceitam hífen (`^[a-z][a-z0-9_]{1,62}$`), e o slug do
 * catálogo usa hífen. A mesma forma serve às duas RPCs — não precisam
 * combinar entre si, só cada uma bater com o próprio regex.
 */
function codigoDoRelatorio(slug: string): string {
  return `report_${slug.replace(/-/g, "_")}`;
}

/** O slug do catálogo, a partir do código gravado no banco — o inverso de `codigoDoRelatorio`. */
function slugDoCodigo(codigo: string): string {
  return codigo.replace(/^report_/, "").replace(/_/g, "-");
}

/** Exportação (com trilha) e compartilhamento (sem backend). Ver `createReportOperations`. */
export const { exportar, createShareLink } = createReportOperations(
  run,
  ({ slug, rowCount }) => logarExportacao({ escopo: codigoDoRelatorio(slug), linhas: rowCount }),
);

/* -------------------------------------------------------------------------
   AGENDAMENTO — `report_schedules` + `report_runs`, desde 25/09/2026
   -------------------------------------------------------------------------
   Cada agendamento entrega para a PRÓPRIA conta — `p_recipient_account_id`
   fica de fora das chamadas e a função assume `auth.uid()`. Não há seletor de
   destinatário na tela: escolher outro administrador exigiria listar quem tem
   o perfil, e o ganho não paga a complexidade agora.
   ------------------------------------------------------------------------- */

const FREQUENCIA_PARA_BANCO: Record<FrequenciaRelatorio, string> = {
  diaria: "daily",
  semanal: "weekly",
  mensal: "monthly",
};

const FREQUENCIA_DO_BANCO: Record<string, FrequenciaRelatorio> = {
  daily: "diaria",
  weekly: "semanal",
  monthly: "mensal",
};

interface LinhaAgendamento {
  id: string;
  report_code: string;
  frequency: string;
  weekday: number | null;
  month_day: number | null;
  send_at: string;
  is_active: boolean;
  next_run_at: string;
  last_run_at: string | null;
}

function projetarAgendamento(linha: LinhaAgendamento): AgendamentoRelatorio {
  return {
    id: linha.id,
    slug: slugDoCodigo(linha.report_code),
    frequencia: FREQUENCIA_DO_BANCO[linha.frequency] ?? "diaria",
    horario: linha.send_at.slice(0, 5),
    dia_semana: linha.weekday,
    dia_mes: linha.month_day,
    ativo: linha.is_active,
    proxima_em: linha.next_run_at,
    ultima_em: linha.last_run_at,
  };
}

const SELECT_AGENDAMENTO =
  "id, report_code, frequency, weekday, month_day, send_at, is_active, next_run_at, last_run_at";

export async function listAgendamentos(): Promise<ListResult<AgendamentoRelatorio>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("report_schedules")
      .select(SELECT_AGENDAMENTO)
      .order("next_run_at");

    if (error) return falhaDe(error);

    return ok((data as unknown as LinhaAgendamento[]).map(projetarAgendamento));
  });
}

async function buscarAgendamento(id: string): Promise<AgendamentoRelatorio | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient()
    .from("report_schedules")
    .select(SELECT_AGENDAMENTO)
    .eq("id", id)
    .single();

  if (error) return falhaDe(error);
  return projetarAgendamento(data as unknown as LinhaAgendamento);
}

export async function criarAgendamento(
  params: AgendamentoRelatorioEntrada,
): Promise<SingleResult<AgendamentoRelatorio>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().rpc("create_report_schedule", {
      p_report_code: codigoDoRelatorio(params.slug),
      p_frequency: FREQUENCIA_PARA_BANCO[params.frequencia],
      p_send_at: params.horario,
      p_weekday: params.diaSemana ?? null,
      p_month_day: params.diaMes ?? null,
    });

    if (error) return falhaDe(error);

    const agendamento = await buscarAgendamento(data as string);
    if (!("id" in agendamento)) return agendamento;

    return okOne(agendamento);
  });
}

export async function atualizarAgendamento({
  id,
  ...params
}: AgendamentoRelatorioEntrada & { id: string }): Promise<SingleResult<AgendamentoRelatorio>> {
  return executar(async () => {
    // A RPC substitui o agendamento inteiro e não tem parâmetro opcional de
    // destinatário — precisa vir explícito. Reenviamos o mesmo de sempre, em
    // vez de trocar por quem está editando: mudar quem recebe não é efeito
    // esperado de "trocar o horário".
    const { data, error: erroLeitura } = await getSupabaseClient()
      .from("report_schedules")
      .select("recipient_account_id")
      .eq("id", id)
      .single();

    if (erroLeitura) return falhaDe(erroLeitura);

    const { error } = await getSupabaseClient().rpc("update_report_schedule", {
      p_schedule_id: id,
      p_report_code: codigoDoRelatorio(params.slug),
      p_frequency: FREQUENCIA_PARA_BANCO[params.frequencia],
      p_send_at: params.horario,
      p_weekday: params.diaSemana ?? null,
      p_month_day: params.diaMes ?? null,
      p_recipient_account_id: (data as { recipient_account_id: string }).recipient_account_id,
    });

    if (error) return falhaDe(error);

    const agendamento = await buscarAgendamento(id);
    if (!("id" in agendamento)) return agendamento;

    return okOne(agendamento);
  });
}

export async function setAgendamentoAtivo({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}): Promise<SingleResult<AgendamentoRelatorio>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("set_report_schedule_active", {
      p_schedule_id: id,
      p_is_active: ativo,
    });

    if (error) return falhaDe(error);

    const agendamento = await buscarAgendamento(id);
    if (!("id" in agendamento)) return agendamento;

    return okOne(agendamento);
  });
}

interface LinhaExecucao {
  id: string;
  report_code: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

/** As últimas gerações, mais recente primeiro — a prova de que a rotina roda. */
export async function listExecucoes(): Promise<ListResult<ExecucaoRelatorio>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("report_runs")
      .select("id, report_code, period_start, period_end, created_at")
      .order("created_at", { ascending: false })
      .limit(TETO_READ);

    if (error) return falhaDe(error);

    return ok(
      (data as unknown as LinhaExecucao[]).map((linha) => ({
        id: linha.id,
        slug: slugDoCodigo(linha.report_code),
        periodo_de: linha.period_start,
        periodo_ate: linha.period_end,
        gerado_em: linha.created_at,
      })),
    );
  });
}

export { exportar as export };
