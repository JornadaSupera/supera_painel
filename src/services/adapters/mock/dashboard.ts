import type { Periodo } from "@/lib/enums";
import {
  efeitosPorProtocolo,
  engajamentoSemanal,
  kpisPorPeriodo,
  META_SESSOES_MES,
  OCUPACAO_PERCENTUAL,
  pacientesPorCid,
  sessoesQuimio,
} from "@/mocks/metricas";
import type { KpisResposta, SeriesResposta } from "@/types/dashboard";
import { okOne, type SingleResult } from "@/services/contracts";
import { simulate } from "./_helpers";

/**
 * Métricas do painel executivo.
 *
 * Na Fase 15 estas duas operações viram consultas a *views* materializadas no
 * Postgres — `vw_dashboard_metricas` e afins. Agregação nunca deve ser feita no
 * front-end: é caro, é lento e mandaria linha individual de paciente para o
 * navegador só para somá-la.
 */

export async function getKpis({
  periodo = "mensal",
}: {
  periodo?: Periodo;
} = {}): Promise<SingleResult<KpisResposta>> {
  return simulate(() =>
    okOne<KpisResposta>({
      periodo,
      kpis: kpisPorPeriodo[periodo],
      atualizado_em: new Date().toISOString(),
    }),
  );
}

export async function getSeries({
  periodo = "mensal",
}: {
  periodo?: Periodo;
} = {}): Promise<SingleResult<SeriesResposta>> {
  return simulate(() =>
    okOne<SeriesResposta>({
      periodo,
      sessoes: sessoesQuimio[periodo],
      meta_sessoes: META_SESSOES_MES,
      ocupacao_percentual: OCUPACAO_PERCENTUAL,
      pacientes_por_cid: pacientesPorCid,
      efeitos_por_protocolo: efeitosPorProtocolo,
      // O engajamento é sempre semanal — é assim que o protótipo o apresenta,
      // e é o recorte em que a métrica faz sentido.
      engajamento: engajamentoSemanal,
      atualizado_em: new Date().toISOString(),
    }),
  );
}
