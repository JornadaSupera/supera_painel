import { PERIODO, STATUS_PACIENTE, type Periodo } from "@/lib/enums";
import { pluralize } from "@/lib/format";
import { failWith, okOne, type SingleResult } from "@/services/contracts";
import type {
  EfeitoPorProtocolo,
  FatiaCid,
  Kpi,
  KpisResposta,
  PontoSessoes,
  SeriesResposta,
} from "@/types/dashboard";
import type { PacienteListItem } from "@/types/paciente";
import { TETO_READ, compartilharLeitura, executar, falhaDe, logarExportacao } from "./_helpers";
import {
  SITUACAO,
  falhou,
  janelaDeDias,
  janelaDeMeses,
  resumirAgenda,
  resumirChat,
  rotuloDoMes,
} from "./_summaries";
import { contarFilaDeAlertas } from "./_alertQueue";
import { getSupabaseClient } from "./client";
import { crossTab } from "./estatisticasClinicas";
import { varrerLista } from "./pacientes";
import { getSummary as getSatisfactionSummary } from "./satisfacao";

/**
 * Painel executivo.
 *
 * A família `summarize_*` é a camada de agregação do banco: ela devolve a
 * contagem já somada, **sem que nenhuma linha de prontuário chegue ao
 * navegador**. Paga UMA leitura auditada onde varrer paciente a paciente
 * pagaria uma por pessoa — e é por isso que o gráfico existe sem que a trilha
 * vire uma lista de "administrador leu o prontuário de fulano".
 *
 * | Indicador           | Situação |
 * |---------------------|----------|
 * | Pacientes ativos    | ✅ `read_patient_list`, via `varrerLista` |
 * | Novos pacientes     | ✅ `read_patient_list`, por `created_at` |
 * | Sessões de quimio   | ✅ `summarize_appointments`, tipo infusão, situação realizada |
 * | Tempo de resposta   | ✅ `summarize_chat_response_times` |
 * | Pacientes por CID   | ✅ `read_patient_list`, que projeta o CID principal |
 * | Engajamento do app  | ❌ sem definição em fonte nenhuma — não é falta de dado |
 * | NPS                 | ⏳ existe (tela Satisfação); o cartão do Dashboard ainda não o lê |
 * | Alertas ativos      | ❌ sem resumo agregado de alertas que não identifique paciente |
 *
 * Os sem fonte são **omitidos**, não zerados. Um cartão marcando zero afirma
 * que a clínica não teve nenhuma sessão no mês — informação falsa, e pior do
 * que a ausência do cartão.
 *
 * > [!] Ocupação da sala continua fora, e não é limitação de leitura.
 * O volume o banco devolve; a CAPACIDADE INSTALADA não é dado de lugar nenhum,
 * e uma taxa precisa das duas. Publicar o volume como se fosse taxa seria
 * inventar o denominador.
 */

/* -------------------------------------------------------------------------
   JANELA DE COMPARAÇÃO
   ------------------------------------------------------------------------- */

const DIAS_POR_PERIODO: Record<Periodo, number> = {
  [PERIODO.DIARIO]: 1,
  [PERIODO.SEMANAL]: 7,
  [PERIODO.MENSAL]: 30,
};

const ROTULO_PERIODO: Record<Periodo, string> = {
  [PERIODO.DIARIO]: "dia",
  [PERIODO.SEMANAL]: "semana",
  [PERIODO.MENSAL]: "mês",
};

const BALDES_HISTORICO = 7;

/** O NPS é lido numa janela fixa: ver o comentário onde ele entra nos indicadores. */
const NPS_JANELA_DIAS = 90;

/** O recorte padrão do gráfico de efeitos: o mesmo que a tela de Estatísticas clínicas abre. */
const EFEITOS_DIAS = 90;
const EFEITOS_GRAU_MINIMO = 2;
const EFEITOS_NO_GRAFICO = 4;
const PROTOCOLOS_NO_GRAFICO = 6;
const UM_DIA = 24 * 60 * 60 * 1000;

/** Instante de cadastro de um item da listagem, ou `null` quando ausente. */
function instanteDeCadastro(item: PacienteListItem): number | null {
  return item.criado_em ? new Date(item.criado_em).getTime() : null;
}

/**
 * Série de `BALDES_HISTORICO` pontos, do mais antigo ao mais recente.
 *
 * `cumulativo` distingue as duas leituras: o total de pacientes ativos é um
 * acumulado (quantos existiam ao fim de cada balde), enquanto entradas novas
 * são a contagem dentro do balde.
 */
function historico(
  datas: number[],
  dias: number,
  { cumulativo }: { cumulativo: boolean },
): number[] {
  const agora = Date.now();
  const largura = dias * UM_DIA;

  return Array.from({ length: BALDES_HISTORICO }, (_, indice) => {
    const fim = agora - (BALDES_HISTORICO - 1 - indice) * largura;
    const inicio = fim - largura;

    return datas.filter((data) => (cumulativo ? data <= fim : data > inicio && data <= fim)).length;
  });
}

/* -------------------------------------------------------------------------
   SESSÕES DE QUIMIOTERAPIA
   -------------------------------------------------------------------------
   O recorte é tipo "infusão" × situação "realizada". Filtrar o TIPO no
   servidor, e não depois, muda o que a trilha registra: fica dito que a
   varredura foi de um tipo de compromisso, e não da agenda inteira.
   ------------------------------------------------------------------------- */

/**
 * A lista de pacientes que os indicadores e os gráficos leem.
 *
 * Indicadores e gráficos são duas consultas, e as duas partem da MESMA lista: os
 * gráficos filtram os ativos por cima dela. Lida duas vezes, a trilha registrava
 * dois acessos à lista de pacientes por abertura do painel (ver
 * `compartilharLeitura`).
 */
function listaDePacientesDoPainel() {
  return compartilharLeitura(
    "dashboard:lista-de-pacientes",
    5_000,
    () => varrerLista({}, TETO_READ),
    (resultado) => "itens" in resultado,
  );
}

/** O tipo de infusão é catálogo: dez minutos bastam para as duas consultas e para as trocas de período. */
const INFUSAO_VALIDADE_MS = 10 * 60_000;

/** Id do tipo de compromisso de infusão, ou `null` quando o catálogo não o tem. */
async function idDaInfusao(): Promise<string | null | ReturnType<typeof falhaDe>> {
  return compartilharLeitura(
    "appointment_types:infusion",
    INFUSAO_VALIDADE_MS,
    async () => {
      const { data, error } = await getSupabaseClient()
        .from("appointment_types")
        .select("id")
        .eq("code", "infusion")
        .limit(1);

      if (error) return falhaDe(error);
      return (data as { id: string }[])[0]?.id ?? null;
    },
    (resultado) => resultado === null || typeof resultado === "string",
  );
}

/** Sessões realizadas por balde, na janela pedida. Chave = `bucket_start`. */
async function sessoesPorBalde(params: {
  janela: { from: string; to: string };
  granularidade: "day" | "week" | "month";
  tipoId: string;
}): Promise<Map<string, number> | ReturnType<typeof falhaDe>> {
  const resumo = await resumirAgenda({
    janela: params.janela,
    granularidade: params.granularidade,
    tipoId: params.tipoId,
  });

  if (falhou(resumo)) return resumo;

  const porBalde = new Map<string, number>();

  for (const linha of resumo.linhas) {
    if (linha.status_code !== SITUACAO.REALIZADO) continue;

    porBalde.set(
      linha.bucket_start,
      (porBalde.get(linha.bucket_start) ?? 0) + linha.appointment_count,
    );
  }

  return porBalde;
}

/* -------------------------------------------------------------------------
   INDICADORES
   ------------------------------------------------------------------------- */

export async function getKpis(
  params: { periodo?: Periodo } = {},
): Promise<SingleResult<KpisResposta>> {
  return executar(async () => {
    const periodo = params.periodo ?? PERIODO.MENSAL;
    const dias = DIAS_POR_PERIODO[periodo];
    const rotulo = ROTULO_PERIODO[periodo];

    const varredura = await listaDePacientesDoPainel();
    if (!("itens" in varredura)) return varredura;

    const ativos = varredura.itens.filter((item) => item.status === STATUS_PACIENTE.ATIVO);

    // `read_patient_list` tem teto de 200 linhas por chamada. Batendo no teto,
    // o número é um piso, não um total — e a tela precisa dizer isso.
    const parcial = varredura.parcial;

    const agora = Date.now();
    const corte = agora - dias * UM_DIA;
    const corteAnterior = corte - dias * UM_DIA;

    const entradas = varredura.itens
      .map(instanteDeCadastro)
      .filter((data): data is number => data !== null);
    const noPeriodo = entradas.filter((data) => data > corte).length;
    const noPeriodoAnterior = entradas.filter(
      (data) => data > corteAnterior && data <= corte,
    ).length;

    const kpis: Kpi[] = [
      {
        id: "pacientes_ativos",
        label: "Pacientes ativos",
        valor: ativos.length,
        variacao: ativos
          .map(instanteDeCadastro)
          .filter((data): data is number => data !== null)
          .filter((data) => data > corte).length,
        variacao_unidade: "",
        variacao_periodo: rotulo,
        contexto: parcial ? "em tratamento (parcial)" : "em tratamento",
        historico: historico(
          ativos.map(instanteDeCadastro).filter((data): data is number => data !== null),
          dias,
          { cumulativo: true },
        ),
      },
      {
        id: "novos_pacientes",
        label: "Novos pacientes",
        valor: noPeriodo,
        variacao: noPeriodo - noPeriodoAnterior,
        variacao_unidade: "",
        variacao_periodo: rotulo,
        contexto: `entrada ${periodo === PERIODO.DIARIO ? "hoje" : `n${periodo === PERIODO.SEMANAL ? "a semana" : "o mês"}`}`,
        historico: historico(entradas, dias, { cumulativo: false }),
      },
    ];

    /* ------------------------------------------- sessões de quimioterapia */

    const tipoInfusao = await idDaInfusao();
    if (tipoInfusao && typeof tipoInfusao !== "string") return tipoInfusao;

    if (tipoInfusao) {
      // Duas janelas de uma leitura só: a janela pedida e a anterior, para a
      // variação. Baldes diários porque o período pode ser um único dia, e um
      // balde mensal não saberia separar hoje de ontem.
      const baldes = await sessoesPorBalde({
        janela: janelaDeDias(dias * 2),
        granularidade: "day",
        tipoId: tipoInfusao,
      });

      if (!(baldes instanceof Map)) return baldes;

      const somar = (de: number, ate: number) =>
        [...baldes.entries()]
          .filter(([balde]) => {
            const instante = Date.parse(`${balde}T12:00:00Z`);
            return instante > de && instante <= ate;
          })
          .reduce((soma, [, valor]) => soma + valor, 0);

      const noPeriodo = somar(corte, agora);

      /*
       * Zero neste período é medição; agenda inteiramente vazia é ausência de
       * fonte — e as duas produzem o mesmo `0`.
       *
       * O que separa uma da outra é haver QUALQUER balde na janela dupla: uma
       * clínica que registra infusões e não teve nenhuma na semana devolve
       * baldes de outras semanas, e aí o zero é a informação. Uma clínica cuja
       * agenda ainda não é usada não devolve balde nenhum, e aí publicar "0
       * sessões" afirmaria que ninguém se tratou.
       */
      if (baldes.size > 0) {
        kpis.push({
          id: "sessoes_quimio",
          label: "Sessões de quimioterapia",
          valor: noPeriodo,
          variacao: noPeriodo - somar(corteAnterior, corte),
          variacao_unidade: "",
          variacao_periodo: rotulo,
          contexto: "infusões realizadas",
          historico: Array.from({ length: BALDES_HISTORICO }, (_, indice) => {
            const fim = agora - (BALDES_HISTORICO - 1 - indice) * dias * UM_DIA;
            return somar(fim - dias * UM_DIA, fim);
          }),
          relatorio_slug: "sessoes-quimioterapia",
        });
      }
    }

    /* ----------------------------------------- tempo de resposta no chat */

    const chat = await resumirChat({ janela: janelaDeDias(dias * 2), granularidade: "day" });
    if (falhou(chat)) return chat;

    const atendidas = chat.linhas.filter((linha) => linha.answered_count > 0);

    /*
     * Média ponderada pelo número de conversas, não média das médias: um
     * balde com uma conversa e outro com quarenta pesariam igual, e o
     * indicador passaria a descrever o dia fraco.
     *
     * A mediana seria melhor leitura, e o resumo a devolve — mas medianas de
     * baldes diferentes não se combinam, e combiná-las daria um número que
     * não é mediana de nada.
     */
    /**
     * Minutos médios até a primeira resposta, na fatia pedida.
     *
     * `first_response_avg_seconds` é nulo no balde em que ninguém respondeu.
     * Somá-lo como zero puxaria a média para baixo e faria a clínica parecer
     * mais rápida justamente nos dias em que ela não respondeu.
     *
     * `null` quando não houve conversa respondida na fatia — que é diferente
     * de zero minuto, e é o que impede o cartão de anunciar resposta
     * instantânea num período sem atendimento.
     */
    const minutosEntre = (de: number, ate: number): number | null => {
      const medidos = atendidas.filter((linha) => {
        if (linha.first_response_avg_seconds === null) return false;
        const instante = Date.parse(`${linha.bucket_start}T12:00:00Z`);
        return instante > de && instante <= ate;
      });

      const conversas = medidos.reduce((soma, linha) => soma + linha.answered_count, 0);
      if (conversas === 0) return null;

      const segundos = medidos.reduce(
        (soma, linha) => soma + (linha.first_response_avg_seconds ?? 0) * linha.answered_count,
        0,
      );

      return Math.round(segundos / conversas / 60);
    };

    const minutos = minutosEntre(corte, agora);
    const anterior = minutosEntre(corteAnterior, corte);

    /*
     * O cartão fica no lugar mesmo sem conversa respondida no período: trocar
     * para "Diário" fazia o indicador sumir, e o número parecia ter deixado de
     * existir em vez de não ter base naquele dia. `null` vira um traço, com a
     * razão escrita embaixo.
     */
    kpis.push({
      id: "tempo_resposta",
      label: "Tempo de resposta no chat",
      valor: minutos,
      unidade: "min",
      // Sem período anterior medido não há variação: zero seria lido como
      // "estável", e estável é uma afirmação que ninguém apurou.
      ...(minutos !== null && anterior !== null
        ? { variacao: minutos - anterior, variacao_unidade: "" as const, variacao_periodo: rotulo }
        : {}),
      contexto:
        minutos === null
          ? "nenhuma conversa respondida neste período"
          : "até a primeira resposta da equipe",
      // Cair é bom: o cartão fica verde quando o tempo diminui.
      inverter_cor: true,
      historico: Array.from({ length: BALDES_HISTORICO }, (_, indice) => {
        const fim = agora - (BALDES_HISTORICO - 1 - indice) * dias * UM_DIA;
        return minutosEntre(fim - dias * UM_DIA, fim) ?? 0;
      }),
      relatorio_slug: "tempo-resposta-chat",
    });

    /* ------------------------------------------------------------------ NPS */

    /*
     * Janela própria, e não a do seletor: o NPS é uma pergunta aberta em marcos
     * da jornada, e num dia ou numa semana quase nunca há resposta. Amarrá-lo ao
     * seletor faria o cartão sumir ou virar traço a cada troca. A janela vem
     * escrita embaixo do número.
     *
     * É a MESMA leitura da tela Satisfação e do relatório 10 (`getSummary`), não
     * uma conta paralela: os três não podem discordar.
     */
    const satisfacao = await getSatisfactionSummary({ days: NPS_JANELA_DIAS });
    if (satisfacao.error) return failWith(satisfacao.error);

    const pesquisa = satisfacao.data;

    kpis.push({
      id: "nps",
      label: "NPS",
      valor: pesquisa?.nps ?? null,
      contexto:
        !pesquisa || pesquisa.responses === 0
          ? `sem respostas em ${NPS_JANELA_DIAS} dias`
          : `${pluralize(pesquisa.responses, "resposta", "respostas")} · ${NPS_JANELA_DIAS} dias${pesquisa.partial ? " (parcial)" : ""}`,
      historico: [],
      relatorio_slug: "nps",
    });

    /* ------------------------------------------------------------- alertas */

    const fila = await contarFilaDeAlertas();
    if (!("pendentes" in fila)) return fila;

    kpis.push({
      id: "alertas_ativos",
      label: "Alertas ativos",
      valor: fila.pendentes + fila.em_atendimento,
      // Teto da leitura: o número é um mínimo, e dizer "200+" é mais honesto do
      // que um total que parece exato. Ver `_alertQueue`.
      contexto: `${fila.pendentes} pendentes · ${fila.em_atendimento} em atendimento${fila.limitado ? " · leitura limitada, pode haver mais" : ""}`,
      inverter_cor: true,
      historico: [],
    });

    return okOne<KpisResposta>({ periodo, kpis, atualizado_em: new Date().toISOString() });
  });
}

/**
 * A captura do painel saiu do ambiente controlado: a trilha precisa saber.
 * `log_data_export` aceita escopo só em minúsculas, dígitos e sublinhado, e o
 * formato entra nele para a trilha dizer em que arquivo o dado saiu.
 */
export async function registrarExportacao(params: {
  formato: "pdf" | "png";
}): Promise<SingleResult<null>> {
  return executar(async () => {
    await logarExportacao({ escopo: `dashboard_${params.formato}`, linhas: 0 });
    return okOne(null);
  });
}

/**
 * Séries dos gráficos.
 *
 * Duas têm fonte e duas não, e a diferença entre elas não é de volume de dado:
 *
 * - **Sessões** sai de `summarize_appointments`, em baldes mensais.
 * - **Pacientes por CID** sai de `read_patient_list`, que já projeta o CID
 *   principal em cada linha — uma leitura, não uma por paciente.
 * - **Efeitos por protocolo** sai do mesmo cruzamento da tela de Estatísticas
 *   clínicas, no recorte padrão que ela abre (90 dias, grau 2 ou mais, só
 *   ativos). Cada barra diz quantos pacientes o protocolo tem: sem isso, 100 %
 *   sobre um paciente se lê como metade da clínica. Quem quiser outro recorte
 *   abre a tela própria, onde os filtros existem.
 * - **Engajamento** não tem definição em fonte nenhuma. Não é falta de dado: é
 *   falta de decisão sobre qual dos quatro números possíveis é o indicador.
 *
 * As sem fonte vêm vazias e bem formadas, para a tela exibir o motivo em vez de
 * um gráfico sem eixo.
 */
export async function getSeries(
  params: { periodo?: Periodo } = {},
): Promise<SingleResult<SeriesResposta>> {
  return executar(async () => {
    const periodo = params.periodo ?? PERIODO.MENSAL;

    const vazio = {
      periodo,
      meta_sessoes: 0,
      ocupacao_percentual: 0,
      efeitos: [],
      efeitos_por_protocolo: [],
      engajamento: [],
      atualizado_em: new Date().toISOString(),
    };

    /* --------------------------------------------------------- sessões */

    const tipoInfusao = await idDaInfusao();
    if (tipoInfusao && typeof tipoInfusao !== "string") return tipoInfusao;

    let sessoes: PontoSessoes[] = [];

    if (tipoInfusao) {
      const baldes = await sessoesPorBalde({
        janela: janelaDeMeses(BALDES_HISTORICO),
        granularidade: "month",
        tipoId: tipoInfusao,
      });

      if (!(baldes instanceof Map)) return baldes;

      sessoes = [...baldes.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([balde, total]) => ({ periodo: rotuloDoMes(balde), sessoes: total }));
    }

    /* --------------------------------------------- pacientes por CID */

    const lista = await listaDePacientesDoPainel();
    if (!("itens" in lista)) return lista;

    const porCid = new Map<string, { valor: number; descricao: string }>();

    for (const paciente of lista.itens.filter((item) => item.status === STATUS_PACIENTE.ATIVO)) {
      // Ficha sem diagnóstico registrado entra no próprio balde: omiti-la faria
      // a soma das fatias não bater com o total de pacientes ativos, e ninguém
      // confere a soma de um gráfico de pizza.
      const chave = paciente.cid || "Sem diagnóstico";
      const atual = porCid.get(chave) ?? {
        valor: 0,
        descricao: paciente.cid_descricao || "Nenhum CID registrado na ficha",
      };

      porCid.set(chave, { ...atual, valor: atual.valor + 1 });
    }

    const pacientes_por_cid: FatiaCid[] = [...porCid.entries()]
      .map(([nome, dados]) => ({ nome, valor: dados.valor, descricao: dados.descricao }))
      .sort((a, b) => b.valor - a.valor);

    /* ------------------------------------------------ efeitos por protocolo */

    const cruzamento = await crossTab({
      dias: EFEITOS_DIAS,
      grauMinimo: EFEITOS_GRAU_MINIMO,
      apenasAtivos: true,
    });
    if (cruzamento.error) return failWith(cruzamento.error);

    // Só entra no gráfico o que tem denominador: "sem plano terapêutico" não é um
    // conjunto que a janela delimite, e um percentual sobre ele seria inventado.
    const celulas = (cruzamento.data?.celulas ?? []).filter(
      (celula) => celula.percentual !== null && celula.pacientes_total !== null,
    );

    const maiorPrevalencia = new Map<string, { label: string; maximo: number }>();
    for (const celula of celulas) {
      const atual = maiorPrevalencia.get(celula.sintoma_id);
      const percentual = celula.percentual ?? 0;
      if (!atual || percentual > atual.maximo) {
        maiorPrevalencia.set(celula.sintoma_id, { label: celula.sintoma_label, maximo: percentual });
      }
    }

    const efeitos = [...maiorPrevalencia.entries()]
      .sort(([, a], [, b]) => b.maximo - a.maximo)
      .slice(0, EFEITOS_NO_GRAFICO)
      .map(([key, { label }]) => ({ key, label }));

    const tamanhoDoProtocolo = new Map<string, number>();
    for (const celula of celulas) {
      tamanhoDoProtocolo.set(celula.protocolo, celula.pacientes_total ?? 0);
    }

    const efeitos_por_protocolo = [...tamanhoDoProtocolo.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, PROTOCOLOS_NO_GRAFICO)
      .map(([protocolo, pacientes]) => {
        const barra: EfeitoPorProtocolo = { protocolo: `${protocolo} (n=${pacientes})` };

        for (const efeito of efeitos) {
          const celula = celulas.find(
            (item) => item.protocolo === protocolo && item.sintoma_id === efeito.key,
          );
          barra[efeito.key] = celula?.percentual ?? 0;
        }

        return barra;
      });

    return okOne<SeriesResposta>({
      ...vazio,
      sessoes,
      pacientes_por_cid,
      efeitos: efeitos_por_protocolo.length > 0 ? efeitos : [],
      efeitos_por_protocolo,
    });
  });
}
