import { ERROR_CODE, fail, ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type { JanelaOperacional } from "@/services/contracts/operations";
import type {
  EstatisticasOperacionais,
  IndicadorOperacional,
  LinhaEspecialidade,
  PontoVolume,
} from "@/types/estatisticas";
import {
  SEM_AREA,
  SEM_AREA_LABEL,
  SITUACAO,
  falhou,
  janelaDeDias,
  janelaDeMeses,
  resumirAgenda,
  resumirChat,
  rotuloDoMes,
  semanasDa,
  type LinhaResumoAgenda,
  type LinhaResumoChat,
} from "./_summaries";
import { executar } from "./_helpers";

/**
 * Estatísticas operacionais — a operação da clínica.
 *
 * A tela responde: quanto se atende, com que rapidez se responde no chat, onde
 * está o gargalo.
 *
 * > [!] O que mudou
 * Esta tela passou duas entregas declarando ausência de origem, e a ausência era
 * real: `.from("appointments")` e `.from("messages")` devolvem **zero linhas sem
 * erro** para o painel, porque as políticas que atendem o administrador estão
 * declaradas `TO clinical_reader` e `authenticated` não é membro desse papel. A
 * versão anterior a esta somava em cima do vazio e publicava "0 atendimentos por
 * semana" com a mesma aparência de um número medido.
 *
 * Agora os dois números saem de `summarize_appointments` e
 * `summarize_chat_response_times`: duas leituras, agregadas no banco, **sem que
 * nenhuma linha de agenda ou de mensagem chegue ao navegador**. É melhor em
 * privacidade do que a alternativa que se tentou antes, não só em correção.
 *
 * > [!] Por especialidade, nunca por profissional
 * Decisão que sobrevive à mudança de origem, e o banco a acompanha: o recorte
 * das funções de resumo é por especialidade, e não existe por profissional.
 * Ranquear pessoa por volume ou por tempo de resposta transformaria um painel de
 * operação em avaliação individual de desempenho — cujo efeito prático seria a
 * equipe otimizar o número em vez do atendimento.
 *
 * > [!] O mês corrente é parcial
 * A janela termina no instante atual, e não no fim do mês, porque compromisso
 * marcado para semana que vem já existe na agenda. A última barra do gráfico é
 * o mês até hoje — e a tela diz isso.
 */

/** Sete meses, que é o que o gráfico da tela desenha. */
const MESES = 7;

/* -------------------------------------------------------------------------
   O QUE CONTINUA SEM ORIGEM — nomeado, para a tela dizer QUAL falta
   ------------------------------------------------------------------------- */

const SEM_PARAMETRO_OPERACIONAL = "meta_mensal_e_capacidade";

/**
 * Mensagens por dia.
 *
 * `summarize_chat_response_times` conta **conversas**, não mensagens: a unidade
 * do resumo é a conversa aberta e o instante da primeira resposta da equipe. Não
 * há resumo de volume de mensagem, e contá-las exigiria `read_messages` conversa
 * a conversa — cada chamada registrando acesso a conteúdo clínico na trilha.
 * O indicador sai da tela em vez de sair errado.
 */
const SEM_VOLUME_DE_MENSAGEM = "mensagens_dia";

/**
 * Fila de alertas.
 *
 * O módulo existe no banco desde 11/09/2026 — `alerts`, `alert_rules`, a fila de
 * triagem e as RPCs de conduta. O que não existe é **regra**: `alert_rules`
 * nasce vazia de propósito, porque o limiar clínico é decisão da clínica, não de
 * engenharia. Sem regra nada dispara, e a fila fica corretamente silenciosa.
 *
 * Por isso o número continua fora da tela: "0 alertas" não diria "a clínica está
 * sem ocorrência", diria "o gatilho ainda não foi configurado" — e as duas
 * leituras levam a decisões opostas.
 */
const ALERTAS_SEM_REGRA =
  "A fila de alertas existe no backend, mas nenhum gatilho de criticidade foi cadastrado: sem regra, nenhum alerta dispara e a fila fica vazia por configuração, não por ausência de ocorrência. O limiar é decisão clínica, e quem o cadastra é a administração. Enquanto não houver regra, o painel não exibe o número — 'zero alertas' seria lido como tranquilidade.";

/* -------------------------------------------------------------------------
   AGREGAÇÃO DOS BALDES
   ------------------------------------------------------------------------- */

/** Total de compromissos numa coleção de baldes. `appointment_count` soma limpo. */
function totalDe(linhas: LinhaResumoAgenda[]): number {
  return linhas.reduce((soma, linha) => soma + linha.appointment_count, 0);
}

function totalNaSituacao(linhas: LinhaResumoAgenda[], codigo: string): number {
  return totalDe(linhas.filter((linha) => linha.status_code === codigo));
}

/** Uma linha por área de origem, com o balde nulo rotulado em vez de descartado. */
function porEspecialidade(linhas: LinhaResumoAgenda[]): LinhaEspecialidade[] {
  const porArea = new Map<string, LinhaResumoAgenda[]>();

  for (const linha of linhas) {
    const chave = linha.specialty_id ?? SEM_AREA;
    const atual = porArea.get(chave);
    if (atual) atual.push(linha);
    else porArea.set(chave, [linha]);
  }

  return [...porArea.entries()]
    .map(([especialidade, doGrupo]) => ({
      especialidade,
      label: doGrupo[0]?.specialty_label ?? SEM_AREA_LABEL,
      volume: totalDe(doGrupo),
      faltas: totalNaSituacao(doGrupo, SITUACAO.FALTA),
      cancelamentos: totalNaSituacao(doGrupo, SITUACAO.CANCELADO),
      remarcacoes: totalNaSituacao(doGrupo, SITUACAO.REMARCADO),
    }))
    .sort((a, b) => b.volume - a.volume);
}

/** Série mensal do volume, na ordem do calendário. */
function volumeMensal(linhas: LinhaResumoAgenda[]): PontoVolume[] {
  const porBalde = new Map<string, number>();

  for (const linha of linhas) {
    porBalde.set(linha.bucket_start, (porBalde.get(linha.bucket_start) ?? 0) + linha.appointment_count);
  }

  return [...porBalde.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([balde, total]) => ({ mes: rotuloDoMes(balde), total }));
}

/**
 * Tempo até a primeira resposta da equipe, em minutos.
 *
 * Média **ponderada pelas conversas respondidas** de cada balde, não média das
 * médias: um balde com três conversas não pode pesar o mesmo que um com
 * trezentas. `null` quando nenhuma conversa da janela foi respondida — e aí a
 * tela mostra "—", porque zero minuto afirmaria atendimento instantâneo.
 */
function tempoDeRespostaEmMinutos(linhas: LinhaResumoChat[]): number | null {
  let segundos = 0;
  let respondidas = 0;

  for (const linha of linhas) {
    if (linha.first_response_avg_seconds === null || linha.answered_count === 0) continue;
    segundos += linha.first_response_avg_seconds * linha.answered_count;
    respondidas += linha.answered_count;
  }

  return respondidas === 0 ? null : Math.round(segundos / respondidas / 60);
}

function somaChat(linhas: LinhaResumoChat[], campo: keyof LinhaResumoChat): number {
  return linhas.reduce((soma, linha) => soma + Number(linha[campo] ?? 0), 0);
}

/** Percentual com uma casa, ou `null` sem denominador — nunca 0 por divisão vazia. */
function percentual(parte: number, total: number): number | null {
  return total === 0 ? null : Math.round((parte / total) * 1000) / 10;
}

function montarIndicadores(
  agenda: LinhaResumoAgenda[],
  chat: LinhaResumoChat[],
  semanas: number,
): IndicadorOperacional[] {
  const volume = totalDe(agenda);
  const faltas = totalNaSituacao(agenda, SITUACAO.FALTA);
  const realizados = totalNaSituacao(agenda, SITUACAO.REALIZADO);
  const semResposta = somaChat(chat, "unanswered_count");
  const conversas = somaChat(chat, "conversation_count");

  return [
    {
      chave: "tempo_resposta_chat",
      label: "Tempo resp. chat",
      valor: tempoDeRespostaEmMinutos(chat),
      unidade: "min",
      contexto: "primeira resposta da equipe",
      inverter_cor: true,
    },
    {
      chave: "taxa_falta",
      label: "Taxa de falta",
      // Denominador é o total de compromissos da janela — o mesmo que o
      // relatório de faltas usa. Duas taxas de falta com denominadores
      // diferentes na mesma tela é pior que uma taxa imperfeita.
      valor: percentual(faltas, volume),
      unidade: "%",
      contexto: `${faltas} de ${volume} compromissos`,
      inverter_cor: true,
    },
    {
      chave: "atendimentos_semana",
      label: "Atendimentos / sem",
      valor: volume === 0 ? null : Math.round(realizados / semanas),
      unidade: "",
      contexto: "compromissos realizados",
    },
    {
      chave: "conversas_sem_resposta",
      label: "Conversas s/ resposta",
      valor: conversas === 0 ? null : semResposta,
      unidade: "",
      // O viés é da função, e a tela precisa dizê-lo: a janela recorta a
      // ABERTURA da conversa, então a aberta no fim do período e respondida
      // depois entra aqui. A janela recente sempre parece pior do que foi.
      contexto: `de ${conversas} abertas no período`,
      inverter_cor: true,
    },
  ];
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

interface Consolidado {
  agenda: LinhaResumoAgenda[];
  chat: LinhaResumoChat[];
  semanas: number;
}

/**
 * As duas leituras de resumo da janela, em paralelo.
 *
 * Sem `dias`, a janela é a da tela — sete meses, que é o que o gráfico desenha.
 * Com `dias`, é a de quem chamou: os relatórios têm o próprio período, e um
 * cartão que diz "últimos 30 dias" sobre uma leitura de sete meses seria uma
 * legenda errada sobre um número certo.
 */
async function consolidar(params?: JanelaOperacional): Promise<Consolidado | ReturnType<typeof fail>> {
  const janela = params?.dias ? janelaDeDias(params.dias) : janelaDeMeses(MESES);

  const [agenda, chat] = await Promise.all([
    resumirAgenda({ janela }),
    resumirChat({ janela }),
  ]);

  if (falhou(agenda)) return agenda;
  if (falhou(chat)) return chat;

  return { agenda: agenda.linhas, chat: chat.linhas, semanas: semanasDa(janela) };
}

export async function getIndicadores(
  params?: JanelaOperacional,
): Promise<SingleResult<EstatisticasOperacionais>> {
  return executar(async () => {
    const dados = await consolidar(params);
    if (!("agenda" in dados)) return dados;

    return okOne<EstatisticasOperacionais>({
      indicadores: montarIndicadores(dados.agenda, dados.chat, dados.semanas),
      por_especialidade: porEspecialidade(dados.agenda),
      volume_mensal: volumeMensal(dados.agenda),
      sem_origem: [SEM_PARAMETRO_OPERACIONAL, SEM_VOLUME_DE_MENSAGEM],
    });
  });
}

/* -------------------------------------------------------------------------
   RECORTES DA MESMA LEITURA
   -------------------------------------------------------------------------
   As três operações abaixo existem no contrato como perguntas separadas e
   respondem da mesma origem. Nenhuma refaz a conta: todas passam pela mesma
   consolidação, para que um ajuste de janela não precise ser lembrado em quatro
   lugares.
   ------------------------------------------------------------------------- */

export async function getTempoResposta(
  params?: JanelaOperacional,
): Promise<SingleResult<IndicadorOperacional>> {
  return executar(async () => {
    const dados = await consolidar(params);
    if (!("agenda" in dados)) return dados;

    const indicador = montarIndicadores(dados.agenda, dados.chat, dados.semanas).find(
      (item) => item.chave === "tempo_resposta_chat",
    );

    return indicador
      ? okOne(indicador)
      : fail(ERROR_CODE.UNKNOWN, "Indicador de tempo de resposta não foi montado.");
  });
}

export async function getAdesaoAgenda(
  params?: JanelaOperacional,
): Promise<ListResult<LinhaEspecialidade>> {
  return executar(async () => {
    const dados = await consolidar(params);
    if (!("agenda" in dados)) return dados;

    const linhas = porEspecialidade(dados.agenda);
    return ok(linhas, linhas.length);
  });
}

export async function getGargalos(
  params?: JanelaOperacional,
): Promise<ListResult<PontoVolume>> {
  return executar(async () => {
    const dados = await consolidar(params);
    if (!("agenda" in dados)) return dados;

    const linhas = volumeMensal(dados.agenda);
    return ok(linhas, linhas.length);
  });
}

/** Ver `ALERTAS_SEM_REGRA`: a fila existe, o gatilho é que não foi cadastrado. */
export async function getFilaAlertas(): Promise<ListResult<never>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, ALERTAS_SEM_REGRA);
}
