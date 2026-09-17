import { FASE_TRATAMENTO_LABEL } from "@/lib/enums";
import { ERROR_CODE, fail, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type { DefinicaoRelatorio, ResultadoRelatorio } from "@/types/relatorio";
import {
  bySpecialtyReport,
  chatResponseReport,
  createReportOperations,
  effectsByProtocolReport,
  isReportFailure,
  listDefinitionsWithout,
  type ReportOutcome,
  type ReportParams,
} from "../_reports";
import { TETO_READ, executar, falhaDe } from "./_helpers";
import {
  SITUACAO,
  falhou,
  janelaDeDias,
  resumirAgenda,
  rotuloDoMes,
} from "./_summaries";
import { getSupabaseClient } from "./client";
import { crossTab } from "./estatisticasClinicas";
import { getIndicadores } from "./estatisticasOperacionais";
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
 * aconteceu nesta rodada: **oito dos doze passaram a rodar** e nenhuma linha da
 * tela mudou junto.
 *
 * > [!] O que destravou, e o que continua fora
 * A família `summarize_*` deu ao painel a leitura em conjunto que faltava —
 * contagem somada no banco, sem linha de prontuário no navegador —, e
 * `read_patient_list` deu busca, filtro e total à listagem. Com as duas, agenda,
 * chat, diário, protocolo, fase e CID passaram a ter fonte.
 *
 * Os quatro que sobram não esperam leitura nenhuma: esperam **definição**. Cada
 * um diz o seu motivo no próprio cartão, porque o conjunto de doze é contratado
 * e sumir com o cartão esconderia o que falta entregar.
 */

/** Teto de varredura da base para os relatórios que contam pacientes. */
const TETO_VARREDURA = TETO_READ * 10;

/**
 * O QUE CONTINUA SEM ORIGEM — e por quê.
 * =============================================================================
 * Nenhum dos quatro é limitação de leitura. Tirar um slug desta lista sem que a
 * definição exista publica um número calculado sobre critério inventado, que é
 * pior do que um cartão que diz o que falta.
 */
const SEM_ORIGEM: Record<string, string> = {
  "alertas-ia":
    "A fila de alertas existe no backend, mas nenhum gatilho de criticidade foi cadastrado: sem regra, nenhum alerta dispara. O limiar é decisão clínica, e cadastrá-lo é ato da administração. Fila priorizada por IA, além disso, é do nível Completo — fora do escopo contratado.",
  nps: "As tabelas e a função da pesquisa existem, mas nenhuma pesquisa é aberta: a rotina agendada que dispara o NPS não foi criada, e dois dos três marcos dependem do plano terapêutico, que só a integração com o Gemed preenche. Sem pesquisa aberta não há resposta para contar.",
  "conteudo-mais-acessado":
    "A contagem de acessos vive na biblioteca do paciente, e nem a equipe nem a administração têm política de leitura ali. Sem ela não há ranking — e a leitura existe para o titular do dado, não para quem publica.",
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
      `${varredura.itens.length} pacientes ativos` +
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
      `${linhas.length} códigos · ${comCid} de ${varredura.itens.length} fichas com diagnóstico principal registrado` +
      (varredura.parcial ? avisoDeParcial(varredura.total, varredura.itens.length) : ""),
    eixo: "codigo",
    medida: "total",
  };
}

/**
 * Novos pacientes por mês.
 *
 * É o **último uso de `read_patients`** no painel, e não por preferência:
 * `read_patient_list` ordena por data de cadastro e **não devolve a coluna**,
 * então a série mensal não tem de onde sair. Enquanto a data não entrar na
 * projeção da listagem, este relatório carrega o teto de 200 do servidor — e
 * avisa quando bate nele, porque um piso apresentado como total é a mesma falha
 * que este arquivo existe para evitar.
 */
async function novosPacientes(dias: number): Promise<ReportOutcome> {
  const { data, error } = await getSupabaseClient().rpc("read_patients", {
    p_limit: TETO_READ,
    p_offset: 0,
  });

  if (error) return falhaDe(error);

  const desde = janelaDeDias(dias).from;
  const todos = (data ?? []) as { created_at: string }[];
  const noPeriodo = todos.filter((linha) => linha.created_at >= desde);

  const porMes = new Map<string, number>();
  for (const linha of noPeriodo) {
    const chave = `${linha.created_at.slice(0, 7)}-01`;
    porMes.set(chave, (porMes.get(chave) ?? 0) + 1);
  }

  const linhas = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, total]) => ({ mes: rotuloDoMes(chave), total }));

  const total = linhas.reduce((soma, ponto) => soma + ponto.total, 0);
  const truncado = todos.length >= TETO_READ;

  return {
    slug: "novos-pacientes",
    titulo: "Novos pacientes no período",
    colunas: [
      { key: "mes", label: "Mês" },
      { key: "total", label: "Novos pacientes", numerica: true },
    ],
    linhas,
    resumo: truncado
      ? `${total} cadastros nos últimos ${dias} dias · CONTAGEM PARCIAL: a leitura atingiu o teto de ${TETO_READ} fichas do backend e não cobre a base inteira`
      : `${total} cadastros nos últimos ${dias} dias`,
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
    resumo: `${total} sessões realizadas nos últimos ${dias} dias · taxa de ocupação da sala indisponível: a capacidade instalada não é dado do backend`,
    eixo: "mes",
    medida: "total",
  };
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
        case "faltas-cancelamentos":
        case "volume-por-especialidade":
          return bySpecialtyReport(params.slug, await getIndicadores({ dias }));
        case "tempo-resposta-chat":
          return chatResponseReport(await getIndicadores({ dias }));
        default:
          return fail(ERROR_CODE.NOT_FOUND, `Relatório "${params.slug}" não existe no catálogo.`);
      }
    };

    const saida = await executarRelatorio();
    return isReportFailure(saida) ? saida : okOne(saida);
  });
}

/** Exportação e agendamento/compartilhamento (sem backend). Ver `createReportOperations`. */
export const { exportar, schedule, listSchedules, createShareLink } = createReportOperations(run);

export { exportar as export };
