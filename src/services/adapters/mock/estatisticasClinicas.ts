import { pacientes } from "@/mocks/pacientes";
import { efeitosAdversos, protocolos } from "@/mocks/protocolos";
import { ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type {
  CelulaCruzamento,
  ComparacaoProtocolo,
  CruzamentoClinico,
} from "@/types/estatisticas";
import { simulate } from "./_helpers";

/**
 * Estatísticas clínicas — cruzamento sobre a base fictícia.
 *
 * Os percentuais são DERIVADOS do protocolo e do efeito, não sorteados: a mesma
 * célula devolve o mesmo número a cada carregamento. Um mapa de calor que muda
 * de cor a cada F5 é impossível de conferir, e ninguém confia numa estatística
 * que se mexe sozinha.
 *
 * O denominador é real — conta os pacientes do mock em cada protocolo —, então
 * filtrar por "apenas ativos" muda a conta de verdade.
 */

interface Parametros {
  grauMinimo?: number;
  dias?: number;
  apenasAtivos?: boolean;
}

/**
 * Prevalência estável para um par protocolo × efeito.
 *
 * Soma dos códigos dos dois nomes, dobrada num intervalo plausível (10 % a
 * 70 %) e reduzida conforme o grau mínimo exigido — quanto mais alto o grau,
 * menos gente o relata, que é a única coisa que esta função precisa imitar.
 */
function prevalencia(protocolo: string, efeito: string, grauMinimo: number): number {
  let semente = 0;
  for (const texto of [protocolo, efeito]) {
    for (let i = 0; i < texto.length; i += 1) semente += texto.charCodeAt(i) * (i + 1);
  }

  const base = 10 + (semente % 61);
  const desconto = Math.max(0, grauMinimo - 2) * 12;

  return Math.max(0, base - desconto);
}

function montar(params: Parametros): CruzamentoClinico {
  const grau_minimo = params.grauMinimo ?? 2;
  const apenasAtivos = params.apenasAtivos ?? true;

  const considerados = pacientes.filter(
    (paciente) => !apenasAtivos || paciente.status === "ativo",
  );

  // O paciente guarda o id do protocolo; o mapa de calor é rotulado pelo nome.
  const nomePorProtocolo = new Map(protocolos.map((protocolo) => [protocolo.id, protocolo.nome]));

  const totalPorProtocolo = new Map<string, number>();
  for (const paciente of considerados) {
    const nome = nomePorProtocolo.get(paciente.protocolo_id);
    if (!nome) continue;
    totalPorProtocolo.set(nome, (totalPorProtocolo.get(nome) ?? 0) + 1);
  }

  const nomes = [...totalPorProtocolo.keys()].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const sintomas = efeitosAdversos.map((efeito) => ({ id: efeito.id, label: efeito.nome }));

  const celulas: CelulaCruzamento[] = [];

  for (const protocolo of nomes) {
    const pacientes_total = totalPorProtocolo.get(protocolo) ?? 0;

    for (const sintoma of sintomas) {
      const percentual = prevalencia(protocolo, sintoma.label, grau_minimo);

      celulas.push({
        protocolo,
        sintoma_id: sintoma.id,
        sintoma_label: sintoma.label,
        pacientes_com: Math.round((percentual / 100) * pacientes_total),
        pacientes_total,
        percentual: pacientes_total === 0 ? null : percentual,
      });
    }
  }

  return {
    protocolos: nomes,
    sintomas,
    celulas,
    grau_minimo,
    pacientes_considerados: considerados.length,
    registros_considerados: celulas.length,
    truncado: false,
  };
}

export async function crossTab(params: Parametros = {}): Promise<SingleResult<CruzamentoClinico>> {
  return simulate(() => okOne(montar(params)));
}

export async function heatmap(params: Parametros = {}): Promise<SingleResult<CruzamentoClinico>> {
  return crossTab(params);
}

export async function compareProtocolos(
  params: Parametros = {},
): Promise<ListResult<ComparacaoProtocolo>> {
  return simulate(() => {
    const dados = montar(params);

    return ok(
      dados.protocolos.map<ComparacaoProtocolo>((protocolo) => {
        const doProtocolo = dados.celulas.filter(
          (celula) => celula.protocolo === protocolo && celula.percentual !== null,
        );

        const soma = doProtocolo.reduce((total, celula) => total + (celula.percentual ?? 0), 0);

        return {
          protocolo,
          pacientes_total: doProtocolo[0]?.pacientes_total ?? 0,
          prevalencia_media:
            doProtocolo.length === 0 ? null : Math.round(soma / doProtocolo.length),
        };
      }),
    );
  });
}
