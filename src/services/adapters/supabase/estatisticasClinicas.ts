import { failWith, ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type { FiltroClinico } from "@/services/contracts/operations";
import type {
  CelulaCruzamento,
  ComparacaoProtocolo,
  CruzamentoClinico,
} from "@/types/estatisticas";
import { executar, logarExportacao } from "./_helpers";
import {
  SEM_PROTOCOLO_LABEL,
  falhou,
  janelaDeDias,
  resumirSintomas,
  type LinhaResumoSintoma,
} from "./_summaries";

/**
 * Estatísticas clínicas — Protocolo × Efeito × Grau.
 *
 * A pergunta da tela: de cada 100 pacientes de um protocolo, quantos relataram
 * determinado sintoma em grau igual ou acima do escolhido?
 *
 * > [!] O que mudou
 * A versão original lia `diary_symptom_reports` linha a linha e cruzava em
 * memória — prontuário viajando para o navegador para virar estatística, com
 * teto de 5.000 registros. Depois, o cruzamento passou a sair de
 * `summarize_symptoms_by_protocol`: uma leitura, somada no banco, sem nenhuma
 * linha de diário no navegador — mas sem denominador, então o mapa mostrava
 * contagem de registros, não prevalência.
 *
 * Em 25/09/2026 (`create_panel_summaries`) a função ganhou as duas colunas que
 * faltavam, e o mapa voltou a mostrar percentual:
 *
 *  - `protocol_patient_count` — pacientes com plano daquele protocolo vigente
 *    em algum ponto da janela. **O denominador.** `null` no balde de protocolo
 *    nulo, de propósito: "sem plano" não é um conjunto que a janela delimite.
 *  - `patients_at_or_above` — pacientes distintos cujo **pior grau** na janela
 *    é ≥ o grau daquela linha. Resolve o problema de somar `patient_count`
 *    entre graus, que contaria duas vezes quem oscilou entre eles.
 *
 * `patients_at_or_above` é por linha, amarrado ao PRÓPRIO grau da linha — não
 * existe "at or above 2" avulso se ninguém relatou exatamente grau 2. A conta
 * usa a linha de MENOR grau dentro do recorte (`grade >= grauMinimo`): como só
 * existe linha para grau efetivamente relatado, essa é sempre a leitura exata
 * para o limiar escolhido — nenhum grau entre o limiar e o encontrado poderia
 * ser o pior grau de alguém sem que a linha dele também existisse.
 *
 * > [!] O balde de protocolo nulo é resultado
 * Conta os eventos de paciente **sem plano terapêutico registrado na data**, e
 * enquanto o Gemed estiver desligado é a maioria — o plano só entra por RPC
 * manual. A linha é rotulada, não descartada, e fica sem percentual (o
 * denominador dela é `null`) mesmo com o resto do mapa em prevalência.
 *
 * > [!] `apenasAtivos` também chegou em 25/09/2026 (`p_active_only`)
 * Recorta pela situação da ficha **hoje**, não na data do evento — a mesma
 * regra do filtro da listagem de pacientes.
 */

/**
 * O recorte da tela. É o tipo do CONTRATO, não uma cópia dele: os dois adapters
 * precisam aceitar exatamente os mesmos filtros, e uma cópia local diverge no
 * dia em que um filtro novo entra em um só dos lados.
 */
type Parametros = FiltroClinico;

/* -------------------------------------------------------------------------
   MONTAGEM DO CRUZAMENTO
   ------------------------------------------------------------------------- */

interface Acumulado {
  registros: number;
  /** O grau da linha mais próxima do limiar, dentro do recorte — ver o cabeçalho. */
  menorGrauNoRecorte: number | null;
  /** `patients_at_or_above` da linha de `menorGrauNoRecorte` — o numerador exato. */
  pacientesAtOuAcima: number;
  /** `protocol_patient_count` do protocolo — o denominador, ou `null` sem ele. */
  pacientesTotal: number | null;
}

function montar(linhas: LinhaResumoSintoma[], grauMinimo: number): CruzamentoClinico {
  const noRecorte = linhas.filter((linha) => linha.grade >= grauMinimo);

  const porCelula = new Map<string, Acumulado>();
  const rotuloSintoma = new Map<string, string>();
  const protocolos = new Set<string>();
  let registrosConsiderados = 0;

  for (const linha of noRecorte) {
    // Sintoma sem id não tem coluna no mapa: o resumo já traz o rótulo por LEFT
    // JOIN para que sintoma aposentado não desapareça, mas sem id não há chave.
    if (!linha.symptom_id) continue;

    const protocolo = linha.protocol_name ?? SEM_PROTOCOLO_LABEL;
    protocolos.add(protocolo);
    rotuloSintoma.set(linha.symptom_id, linha.symptom_label ?? "Sintoma aposentado");

    const chave = `${protocolo}\u0000${linha.symptom_id}`;
    const atual = porCelula.get(chave) ?? {
      registros: 0,
      menorGrauNoRecorte: null,
      pacientesAtOuAcima: 0,
      pacientesTotal: null,
    };

    atual.registros += linha.report_count;

    if (atual.menorGrauNoRecorte === null || linha.grade < atual.menorGrauNoRecorte) {
      atual.menorGrauNoRecorte = linha.grade;
      atual.pacientesAtOuAcima = linha.patients_at_or_above;
      atual.pacientesTotal = linha.protocol_patient_count;
    }

    porCelula.set(chave, atual);
    registrosConsiderados += linha.report_count;
  }

  // "Sem plano terapêutico" vai para o fim: é balde legítimo, e não o primeiro
  // protocolo por acidente de ordenação alfabética.
  const listaProtocolos = [...protocolos].sort((a, b) => {
    if (a === SEM_PROTOCOLO_LABEL) return 1;
    if (b === SEM_PROTOCOLO_LABEL) return -1;
    return a.localeCompare(b, "pt-BR");
  });

  const sintomas = [...rotuloSintoma.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));

  const celulas: CelulaCruzamento[] = [];

  for (const protocolo of listaProtocolos) {
    for (const sintoma of sintomas) {
      const acumulado = porCelula.get(`${protocolo}\u0000${sintoma.id}`);
      if (!acumulado) continue;

      const pacientes_total = acumulado.pacientesTotal;

      celulas.push({
        protocolo,
        sintoma_id: sintoma.id,
        sintoma_label: sintoma.label,
        registros: acumulado.registros,
        pacientes_com: acumulado.pacientesAtOuAcima,
        // `patients_at_or_above` já é o número cheio, nunca piso — ver o cabeçalho.
        pacientes_exato: true,
        pacientes_total,
        percentual:
          pacientes_total === null || pacientes_total === 0
            ? null
            : Math.round((acumulado.pacientesAtOuAcima / pacientes_total) * 1000) / 10,
      });
    }
  }

  return {
    protocolos: listaProtocolos,
    sintomas,
    celulas,
    grau_minimo: grauMinimo,
    // Somar `protocol_patient_count` entre protocolos contaria duas vezes quem
    // trocou de protocolo na janela — por isso continua `null`, e não uma soma
    // que pareceria exata sem ser.
    pacientes_considerados: null,
    registros_considerados: registrosConsiderados,
    prevalencia_disponivel: true,
    // O resumo não tem teto: ele conta no banco em vez de devolver linhas.
    truncado: false,
  };
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

async function cruzar(params: Parametros): Promise<SingleResult<CruzamentoClinico>> {
  return executar(async () => {
    const resumo = await resumirSintomas({
      janela: janelaDeDias(params.dias ?? 90),
      protocolo: params.protocolo ?? null,
      sintomaId: params.sintomaId ?? null,
      cid: params.cid ?? null,
      apenasAtivos: params.apenasAtivos,
    });
    if (falhou(resumo)) return resumo;

    return okOne(montar(resumo.linhas, params.grauMinimo ?? 2));
  });
}

/** A captura saiu do ambiente controlado: a trilha precisa saber. Ver `logarExportacao`. */
export async function registrarExportacao(params: {
  formato: "pdf" | "png";
  linhas: number;
}): Promise<SingleResult<null>> {
  return executar(async () => {
    await logarExportacao({
      escopo: `estatisticas_clinicas_${params.formato}`,
      linhas: params.linhas,
    });
    return okOne(null);
  });
}

export async function crossTab(params: Parametros = {}): Promise<SingleResult<CruzamentoClinico>> {
  return cruzar(params);
}

/** Mesmo cruzamento — o mapa de calor é a forma de desenhá-lo, não outro dado. */
export async function heatmap(params: Parametros = {}): Promise<SingleResult<CruzamentoClinico>> {
  return cruzar(params);
}

/**
 * Leitura comparativa por protocolo.
 *
 * `prevalencia_media` é a média dos percentuais dos sintomas do protocolo —
 * `null` só sobra para "Sem plano terapêutico", que não tem denominador (ver o
 * cabeçalho do arquivo). Ordenado por prevalência, não por registros: é a
 * pergunta comparativa que a tela faz quando há percentual disponível.
 */
export async function compareProtocolos(
  params: Parametros = {},
): Promise<ListResult<ComparacaoProtocolo>> {
  return executar(async () => {
    const cruzamento = await cruzar(params);
    if (cruzamento.error) return failWith(cruzamento.error);

    const dados = cruzamento.data;
    const linhas = (dados?.protocolos ?? []).map<ComparacaoProtocolo>((protocolo) => {
      const doProtocolo = (dados?.celulas ?? []).filter((celula) => celula.protocolo === protocolo);
      const comPercentual = doProtocolo.filter((celula) => celula.percentual !== null);

      const soma = comPercentual.reduce((total, celula) => total + (celula.percentual ?? 0), 0);

      return {
        protocolo,
        pacientes_total: doProtocolo[0]?.pacientes_total ?? null,
        prevalencia_media:
          comPercentual.length === 0
            ? null
            : Math.round((soma / comPercentual.length) * 10) / 10,
        registros: doProtocolo.reduce((total, celula) => total + celula.registros, 0),
      };
    });

    const ordenadas = [...linhas].sort(
      (a, b) => (b.prevalencia_media ?? -1) - (a.prevalencia_media ?? -1) || b.registros - a.registros,
    );
    return ok(ordenadas, ordenadas.length);
  });
}
