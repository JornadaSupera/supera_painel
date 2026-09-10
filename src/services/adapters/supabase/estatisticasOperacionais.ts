import { ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import {
  fail,
  ok,
  okOne,
  type ApiError,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  EstatisticasOperacionais,
  IndicadorOperacional,
  LinhaEspecialidade,
  PontoVolume,
} from "@/types/estatisticas";
import { executar, falhaDe, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraEspecialidade } from "./mapping";

/**
 * Estatísticas operacionais — a operação da clínica.
 *
 * Tudo aqui sai de duas fontes que a política de administrador libera:
 * `appointments` (com os catálogos de tipo e situação) e o par
 * `conversations` / `messages`.
 *
 * > [!] Por especialidade, nunca por profissional.
 * A tabela agrega por área de origem do compromisso. Ranquear pessoa por
 * volume ou por tempo de resposta transformaria um painel de operação em
 * avaliação individual de desempenho — que não é o que foi contratado, e cujo
 * efeito prático seria a equipe otimizar o número em vez do atendimento.
 *
 * > [!] Meta e capacidade não têm origem.
 * O protótipo desenha as linhas de "meta 320/mês" e "capacidade 380/mês". Não
 * existe tabela de parâmetro operacional no banco, e chutar os dois números
 * faria a tela afirmar que a clínica bateu ou furou uma meta que ninguém
 * definiu. Vão declarados em `sem_origem`.
 */

const TETO_COMPROMISSOS = 5000;
const TETO_MENSAGENS = 5000;

/** Meses exibidos na série de volume — o protótipo mostra sete. */
const MESES_DA_SERIE = 7;

interface LinhaCompromisso {
  starts_at: string;
  origin_specialty_id: string | null;
  appointment_statuses: { code: string } | { code: string }[] | null;
  specialties: { code: string } | { code: string }[] | null;
}

interface LinhaMensagem {
  conversation_id: string;
  author_kind: string;
  created_at: string;
}

function inicioDeMesesAtras(meses: number): Date {
  const data = new Date();
  data.setUTCDate(1);
  data.setUTCHours(0, 0, 0, 0);
  data.setUTCMonth(data.getUTCMonth() - meses);
  return data;
}

/** "mar/26" — rótulo curto do eixo, já em pt-BR. */
function rotuloDoMes(data: Date): string {
  return data
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" })
    .replace(".", "");
}

function chaveDoMes(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Tempo médio, em minutos, entre a mensagem do paciente e a primeira resposta
 * da equipe.
 *
 * Conta apenas o PRIMEIRO par de cada conversa. Uma thread longa tem dezenas de
 * idas e vindas, e medi-las todas faria a conversa mais conversada dominar a
 * média — o que a clínica quer saber é quanto tempo alguém espera para ser
 * atendido, não a cadência do bate-papo depois disso.
 */
function tempoMedioDeResposta(mensagens: LinhaMensagem[]): number | null {
  const porConversa = new Map<string, LinhaMensagem[]>();

  for (const mensagem of mensagens) {
    const lista = porConversa.get(mensagem.conversation_id) ?? [];
    lista.push(mensagem);
    porConversa.set(mensagem.conversation_id, lista);
  }

  const esperas: number[] = [];

  for (const lista of porConversa.values()) {
    const ordenadas = [...lista].sort((a, b) => a.created_at.localeCompare(b.created_at));

    const pergunta = ordenadas.find(
      (mensagem) => mensagem.author_kind === "patient" || mensagem.author_kind === "caregiver",
    );
    if (!pergunta) continue;

    const resposta = ordenadas.find(
      (mensagem) =>
        mensagem.author_kind === "professional" && mensagem.created_at > pergunta.created_at,
    );
    if (!resposta) continue;

    const minutos =
      (Date.parse(resposta.created_at) - Date.parse(pergunta.created_at)) / 60_000;

    if (Number.isFinite(minutos) && minutos >= 0) esperas.push(minutos);
  }

  if (esperas.length === 0) return null;

  return Math.round(esperas.reduce((soma, valor) => soma + valor, 0) / esperas.length);
}

export async function getIndicadores(): Promise<SingleResult<EstatisticasOperacionais>> {
  return executar(async () => {
    const supabase = getSupabaseClient();
    const desdeSerie = inicioDeMesesAtras(MESES_DA_SERIE - 1);

    /* ------------------------------------------------------- compromissos */
    const { data: dadosAgenda, error: erroAgenda } = await supabase
      .from("appointments")
      .select(
        "starts_at, origin_specialty_id, appointment_statuses ( code ), specialties:origin_specialty_id ( code )",
      )
      .gte("starts_at", desdeSerie.toISOString())
      .limit(TETO_COMPROMISSOS);

    if (erroAgenda) return falhaDe(erroAgenda);

    const compromissos = dadosAgenda as unknown as LinhaCompromisso[];

    /* ------------------------------------------------------------ mensagens */
    const { data: dadosMensagens, error: erroMensagens } = await supabase
      .from("messages")
      .select("conversation_id, author_kind, created_at")
      .gte("created_at", desdeSerie.toISOString())
      .limit(TETO_MENSAGENS);

    if (erroMensagens) return falhaDe(erroMensagens);

    const mensagens = dadosMensagens as unknown as LinhaMensagem[];

    /* ---------------------------------------------- agregação por especialidade */
    const porEspecialidade = new Map<Especialidade, LinhaEspecialidade>();
    const volumePorMes = new Map<string, number>();

    const inicioDoMes = inicioDeMesesAtras(0).toISOString();
    let terminaisNoMes = 0;
    let faltasNoMes = 0;
    let realizadosNaSerie = 0;

    for (const compromisso of compromissos) {
      const situacao = umDe(compromisso.appointment_statuses)?.code ?? "scheduled";

      volumePorMes.set(
        chaveDoMes(compromisso.starts_at),
        (volumePorMes.get(chaveDoMes(compromisso.starts_at)) ?? 0) + 1,
      );

      if (situacao === "completed") realizadosNaSerie += 1;

      // Taxa de falta é sobre o que JÁ ACONTECEU: um compromisso ainda agendado
      // não é ausência, e incluí-lo no denominador diluiria a taxa a cada
      // agendamento futuro feito.
      if (compromisso.starts_at >= inicioDoMes) {
        if (situacao === "completed" || situacao === "no_show") {
          terminaisNoMes += 1;
          if (situacao === "no_show") faltasNoMes += 1;
        }
      }

      const especialidade = paraEspecialidade(umDe(compromisso.specialties)?.code);
      if (!especialidade) continue;

      const linha = porEspecialidade.get(especialidade) ?? {
        especialidade,
        label: ESPECIALIDADE_LABEL[especialidade],
        volume: 0,
        faltas: 0,
        cancelamentos: 0,
        remarcacoes: 0,
      };

      linha.volume += 1;
      if (situacao === "no_show") linha.faltas += 1;
      if (situacao === "cancelled") linha.cancelamentos += 1;
      if (situacao === "rescheduled") linha.remarcacoes += 1;

      porEspecialidade.set(especialidade, linha);
    }

    /* ------------------------------------------------------ série de volume */
    const volume_mensal: PontoVolume[] = [];

    for (let recuo = MESES_DA_SERIE - 1; recuo >= 0; recuo -= 1) {
      const mes = inicioDeMesesAtras(recuo);
      volume_mensal.push({
        mes: rotuloDoMes(mes),
        total: volumePorMes.get(mes.toISOString().slice(0, 7)) ?? 0,
      });
    }

    /* --------------------------------------------------------- indicadores */
    const semanas = Math.max(1, MESES_DA_SERIE * 4.345);
    const dias = Math.max(1, MESES_DA_SERIE * 30.44);

    const recebidas = mensagens.filter(
      (mensagem) => mensagem.author_kind === "patient" || mensagem.author_kind === "caregiver",
    ).length;

    const indicadores: IndicadorOperacional[] = [
      {
        chave: "tempo_resposta_chat",
        label: "Tempo resp. chat",
        valor: tempoMedioDeResposta(mensagens),
        unidade: "min",
        contexto: "média da equipe",
        inverter_cor: true,
      },
      {
        chave: "taxa_falta",
        label: "Taxa de falta",
        valor: terminaisNoMes === 0 ? null : Math.round((faltasNoMes / terminaisNoMes) * 1000) / 10,
        unidade: "%",
        contexto: "mês atual",
        inverter_cor: true,
      },
      {
        chave: "atendimentos_semana",
        label: "Atendimentos / sem",
        valor: Math.round(realizadosNaSerie / semanas),
        unidade: "",
        contexto: "média do período",
      },
      {
        chave: "mensagens_dia",
        label: "Mensagens / dia",
        valor: Math.round(recebidas / dias),
        unidade: "",
        contexto: "recebidas no chat",
      },
    ];

    return okOne({
      indicadores,
      por_especialidade: [...porEspecialidade.values()].sort((a, b) => b.volume - a.volume),
      volume_mensal,
      // Ver o cabeçalho: não há tabela de parâmetro operacional no banco.
      sem_origem: ["meta_mensal", "capacidade_maxima"],
    });
  });
}

/* -------------------------------------------------------------------------
   RECORTES DA MESMA LEITURA
   -------------------------------------------------------------------------
   As quatro operações abaixo existem no contrato como perguntas separadas, mas
   respondem da mesma consulta: pedir quatro vezes ao banco o que já veio numa
   só multiplicaria a leitura de dado clínico por quatro sem trazer nada novo.
   ------------------------------------------------------------------------- */

/** Repassa o erro preservando o código — quem chamou distingue permissão de queda. */
function repassar(erro: ApiError) {
  return fail(erro.code, erro.message, erro.details);
}

export async function getTempoResposta(): Promise<SingleResult<IndicadorOperacional>> {
  const resultado = await getIndicadores();
  if (resultado.error) return repassar(resultado.error);

  const indicador = resultado.data?.indicadores.find(
    (item) => item.chave === "tempo_resposta_chat",
  );

  return okOne(indicador ?? null);
}

export async function getAdesaoAgenda(): Promise<ListResult<LinhaEspecialidade>> {
  const resultado = await getIndicadores();
  if (resultado.error) return repassar(resultado.error);

  return ok(resultado.data?.por_especialidade ?? []);
}

export async function getGargalos(): Promise<ListResult<PontoVolume>> {
  const resultado = await getIndicadores();
  if (resultado.error) return repassar(resultado.error);

  return ok(resultado.data?.volume_mensal ?? []);
}

/**
 * Fila de alertas: sem origem.
 *
 * O protótipo mostra volume de alertas, tempo até a conduta e desfecho. Nada
 * disso existe no banco — não há tabela de alerta nem regra de criticidade, e
 * derivar "sintoma crítico" a partir do grau seria exatamente a inferência
 * clínica que o painel não faz.
 */
export async function getFilaAlertas(): Promise<ListResult<never>> {
  return ok([]);
}
