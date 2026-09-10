import { useQuery } from "@tanstack/react-query";

import { audit } from "@/lib/audit";
import { queryKeys } from "@/lib/queryKeys";
import { call, estatisticasClinicasApi, estatisticasOperacionaisApi } from "@/services/apiClient";
import type { FiltroClinico } from "@/services/contracts/operations";

/**
 * Leitura das duas telas de estatística.
 *
 * O cruzamento clínico registra auditoria mesmo sendo agregado: ele nasce do
 * diário de sintomas de pessoas identificáveis, e "quem consultou a base
 * clínica, e com que recorte" é pergunta legítima numa apuração. O agregado
 * protege a identidade na TELA; não torna o acesso irrelevante.
 *
 * As operacionais não registram: agenda e chat entram ali como contagem de
 * eventos da clínica, sem recorte que aponte para uma pessoa.
 */

export function useCruzamentoClinico(filtro: FiltroClinico) {
  return useQuery({
    queryKey: queryKeys.statistics.clinical(filtro),
    queryFn: async () => {
      const resultado = await call(() => estatisticasClinicasApi.crossTab(filtro));
      audit.read("estatisticas/clinicas", undefined);
      return resultado.data;
    },
    placeholderData: (anterior) => anterior,
  });
}

export function useComparacaoProtocolos(filtro: FiltroClinico) {
  return useQuery({
    queryKey: [...queryKeys.statistics.clinical(filtro), "comparacao"],
    queryFn: async () =>
      (await call(() => estatisticasClinicasApi.compareProtocolos(filtro))).data,
    placeholderData: (anterior) => anterior,
  });
}

export function useEstatisticasOperacionais() {
  return useQuery({
    queryKey: queryKeys.statistics.operational(),
    queryFn: async () => (await call(() => estatisticasOperacionaisApi.getIndicadores())).data,
  });
}
