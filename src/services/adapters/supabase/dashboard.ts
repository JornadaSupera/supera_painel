import { PERIODO, STATUS_PACIENTE, type Periodo } from "@/lib/enums";
import { okOne, type SingleResult } from "@/services/contracts";
import type { FatiaCid, Kpi, KpisResposta, PontoSessoes, SeriesResposta } from "@/types/dashboard";
import { TETO_READ, executar, falhaDe } from "./_helpers";
import {
  SITUACAO,
  falhou,
  janelaDeDias,
  janelaDeMeses,
  resumirAgenda,
  resumirChat,
  rotuloDoMes,
} from "./_summaries";
import { getSupabaseClient } from "./client";
import { varrerLista } from "./pacientes";

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
 * | Pacientes ativos    | ✅ `read_patients` |
 * | Novos pacientes     | ✅ `read_patients`, por `created_at` |
 * | Sessões de quimio   | ✅ `summarize_appointments`, tipo infusão, situação realizada |
 * | Tempo de resposta   | ✅ `summarize_chat_response_times` |
 * | Pacientes por CID   | ✅ `read_patient_list`, que projeta o CID principal |
 * | Engajamento do app  | ❌ sem definição em fonte nenhuma — não é falta de dado |
 * | NPS                 | ❌ nenhuma pesquisa é aberta: não há resposta para contar |
 * | Alertas ativos      | ❌ nenhum gatilho de criticidade cadastrado |
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
const UM_DIA = 24 * 60 * 60 * 1000;

interface LinhaPaciente {
  is_active: boolean;
  created_at: string;
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

/** Id do tipo de compromisso de infusão, ou `null` quando o catálogo não o tem. */
async function idDaInfusao(): Promise<string | null | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient()
    .from("appointment_types")
    .select("id")
    .eq("code", "infusion")
    .limit(1);

  if (error) return falhaDe(error);
  return (data as { id: string }[])[0]?.id ?? null;
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

    const { data, error } = await getSupabaseClient().rpc("read_patients", {
      p_limit: TETO_READ,
      p_offset: 0,
    });

    if (error) return falhaDe(error);

    const linhas = (data ?? []) as LinhaPaciente[];
    const ativos = linhas.filter((linha) => linha.is_active);

    // `read_patients` tem teto de 200 linhas no servidor. Batendo no teto, o
    // número é um piso, não um total — e a tela precisa dizer isso.
    const parcial = linhas.length >= TETO_READ;

    const agora = Date.now();
    const corte = agora - dias * UM_DIA;
    const corteAnterior = corte - dias * UM_DIA;

    const entradas = linhas.map((linha) => new Date(linha.created_at).getTime());
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
          .map((linha) => new Date(linha.created_at).getTime())
          .filter((data) => data > corte).length,
        variacao_unidade: "",
        variacao_periodo: rotulo,
        contexto: parcial ? "em tratamento (parcial)" : "em tratamento",
        historico: historico(
          ativos.map((linha) => new Date(linha.created_at).getTime()),
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

    if (atendidas.length > 0) {
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

      if (minutos !== null) {
        kpis.push({
          id: "tempo_resposta",
          label: "Tempo de resposta no chat",
          valor: minutos,
          unidade: "min",
          // Sem período anterior medido não há variação: zero seria lido como
          // "estável", e estável é uma afirmação que ninguém apurou.
          variacao: anterior === null ? 0 : minutos - anterior,
          variacao_unidade: "",
          variacao_periodo: anterior === null ? "sem base anterior" : rotulo,
          contexto: "até a primeira resposta da equipe",
          // Cair é bom: o cartão fica verde quando o tempo diminui.
          inverter_cor: true,
          historico: Array.from({ length: BALDES_HISTORICO }, (_, indice) => {
            const fim = agora - (BALDES_HISTORICO - 1 - indice) * dias * UM_DIA;
            return minutosEntre(fim - dias * UM_DIA, fim) ?? 0;
          }),
          relatorio_slug: "tempo-resposta-chat",
        });
      }
    }

    return okOne<KpisResposta>({ periodo, kpis, atualizado_em: new Date().toISOString() });
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
 * - **Efeitos por protocolo** existe no banco, mas na tela de Estatísticas
 *   clínicas, com os filtros que o recorte exige. Repeti-lo aqui sem os
 *   filtros mostraria um número que ninguém sabe interpretar.
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

    const varredura = await varrerLista({ filters: { status: STATUS_PACIENTE.ATIVO } }, TETO_READ);
    if (!("itens" in varredura)) return varredura;

    const porCid = new Map<string, { valor: number; descricao: string }>();

    for (const paciente of varredura.itens) {
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

    return okOne<SeriesResposta>({ ...vazio, sessoes, pacientes_por_cid });
  });
}
