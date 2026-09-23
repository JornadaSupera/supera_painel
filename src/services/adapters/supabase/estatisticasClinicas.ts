import { failWith, ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type { FiltroClinico } from "@/services/contracts/operations";
import type {
  CelulaCruzamento,
  ComparacaoProtocolo,
  CruzamentoClinico,
} from "@/types/estatisticas";
import { executar } from "./_helpers";
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
 * A pergunta original da tela: de cada 100 pacientes de um protocolo, quantos
 * relataram determinado sintoma em grau igual ou acima do escolhido?
 *
 * > [!] O que mudou
 * A versão anterior desta tela lia `diary_symptom_reports` linha a linha e cruzava
 * em memória — prontuário viajando para o navegador para virar estatística, com
 * teto de 5.000 registros e aviso de truncamento na tela. Antes dela, uma versão
 * que somava sobre zero linhas e publicava o mapa vazio explicando o vazio com
 * uma causa falsa ("amplie o período").
 *
 * Agora o cruzamento sai de `summarize_symptoms_by_protocol`: uma leitura, somada
 * no banco, **sem nenhuma linha de diário no navegador** e sem teto. O agregado
 * melhora a privacidade em vez de afrouxá-la, e paga **uma** leitura auditada
 * onde a soma no cliente pagava uma por paciente.
 *
 * > [!] O RESUMO NÃO DEVOLVE DENOMINADOR — e por isso não há percentual
 * A função devolve `report_count` e `patient_count` por protocolo × sintoma ×
 * **grau**. Faltam duas coisas para a prevalência:
 *
 *  1. **O total de pacientes do protocolo no recorte** — o denominador. Nenhuma
 *     coluna o traz, e nenhuma combinação das que existem o reconstrói.
 *  2. **Pacientes distintos com grau ≥ N.** `patient_count` é distinto *dentro*
 *     de um grau. Quem relatou grau 2 num dia e grau 3 noutro aparece nos dois
 *     baldes; somar recontaria a pessoa. O maior balde é um **piso** seguro.
 *
 * Não se aproxima nem um nem outro. Emprestar o denominador de
 * `read_patient_list(p_protocol)` pareceria resolver, mas ali o protocolo é o
 * **vigente hoje**, enquanto o numerador é atribuído ao protocolo **da data do
 * evento** — a razão entre os dois seria um percentual com numerador e
 * denominador de universos diferentes, e nada na tela denunciaria a mistura.
 *
 * Então o mapa mostra o que é exato: **registros**. E declara, em voz alta, o que
 * falta para voltar a mostrar percentual. Pedido registrado com o responsável
 * pelo banco.
 *
 * > [!] O balde de protocolo nulo é resultado
 * Conta os eventos de paciente **sem plano terapêutico registrado na data**, e
 * enquanto o Gemed estiver desligado é a maioria — o plano só entra por RPC
 * manual. A linha é rotulada, não descartada: ela é exatamente a informação que
 * diz de quanto da base o painel ainda não sabe o protocolo.
 */

/** O que impede o percentual, escrito para quem opera o painel. */
const SEM_DENOMINADOR =
  "A leitura agregada do banco devolve quantos registros e quantas pessoas relataram cada sintoma em cada grau, mas não devolve quantos pacientes havia no protocolo no período — que é o denominador da prevalência. Sem ele o mapa mostra a contagem de registros, que é exata, em vez de um percentual calculado sobre um denominador ausente. Pedido registrado com o responsável pelo banco.";

/** A observação sobre o piso, quando o recorte junta mais de um grau. */
const PACIENTES_SAO_PISO =
  "Com mais de um grau no recorte, a contagem de pacientes é um piso: o resumo conta pessoas distintas dentro de cada grau, e quem relatou dois graus diferentes no período apareceria duas vezes se os baldes fossem somados.";

/**
 * O recorte da tela. É o tipo do CONTRATO, não uma cópia dele: os dois adapters
 * precisam aceitar exatamente os mesmos filtros, e uma cópia local diverge no
 * dia em que um filtro novo entra em um só dos lados.
 *
 * > [!] `apenasAtivos` não chega ao resumo.
 * O banco não recorta por situação do paciente: ele agrega sobre os registros
 * de diário do período, e diário de paciente arquivado continua sendo registro
 * daquele período. O filtro segue na assinatura porque é o recorte que a função
 * vai receber quando aceitá-lo, e `filtros_ignorados` na resposta é o que
 * impede a tela de afirmar um filtro que não houve.
 */
type Parametros = FiltroClinico;

/* -------------------------------------------------------------------------
   MONTAGEM DO CRUZAMENTO
   ------------------------------------------------------------------------- */

interface Acumulado {
  registros: number;
  /** Maior `patient_count` entre os graus do recorte — o piso de distintos. */
  pisoPacientes: number;
  /** Quantos graus diferentes entraram na célula. Um só ⇒ o piso é exato. */
  graus: number;
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
    const atual = porCelula.get(chave) ?? { registros: 0, pisoPacientes: 0, graus: 0 };

    atual.registros += linha.report_count;
    atual.pisoPacientes = Math.max(atual.pisoPacientes, linha.patient_count);
    atual.graus += 1;

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

      celulas.push({
        protocolo,
        sintoma_id: sintoma.id,
        sintoma_label: sintoma.label,
        registros: acumulado.registros,
        pacientes_com: acumulado.pisoPacientes,
        pacientes_exato: acumulado.graus === 1,
        pacientes_total: null,
        percentual: null,
      });
    }
  }

  const algumPiso = celulas.some((celula) => !celula.pacientes_exato);

  return {
    protocolos: listaProtocolos,
    sintomas,
    celulas,
    grau_minimo: grauMinimo,
    pacientes_considerados: null,
    registros_considerados: registrosConsiderados,
    prevalencia_disponivel: false,
    motivo_sem_prevalencia: algumPiso ? `${SEM_DENOMINADOR} ${PACIENTES_SAO_PISO}` : SEM_DENOMINADOR,
    filtros_ignorados: ["apenasAtivos"],
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
    });
    if (falhou(resumo)) return resumo;

    return okOne(montar(resumo.linhas, params.grauMinimo ?? 2));
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
 * Sem denominador não há média de prevalência, e uma média de percentuais que não
 * existem não é um número menos errado. O que sai é a carga de relato —
 * registros do protocolo no recorte —, que é exata e responde à mesma pergunta
 * comparativa: onde a equipe recebe mais relato de efeito.
 */
export async function compareProtocolos(
  params: Parametros = {},
): Promise<ListResult<ComparacaoProtocolo>> {
  return executar(async () => {
    const cruzamento = await cruzar(params);
    if (cruzamento.error) return failWith(cruzamento.error);

    const dados = cruzamento.data;
    const linhas = (dados?.protocolos ?? []).map<ComparacaoProtocolo>((protocolo) => ({
      protocolo,
      pacientes_total: null,
      prevalencia_media: null,
      registros: (dados?.celulas ?? [])
        .filter((celula) => celula.protocolo === protocolo)
        .reduce((soma, celula) => soma + celula.registros, 0),
    }));

    const ordenadas = [...linhas].sort((a, b) => b.registros - a.registros);
    return ok(ordenadas, ordenadas.length);
  });
}
