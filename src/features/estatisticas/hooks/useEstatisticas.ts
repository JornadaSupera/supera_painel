import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { call, estatisticasClinicasApi, estatisticasOperacionaisApi } from "@/services/apiClient";
import type { FiltroClinico } from "@/services/contracts/operations";

/**
 * Leitura das duas telas de estatística.
 *
 * > [!] A auditoria do acesso é do BANCO, não deste arquivo
 * As funções de resumo são `SECURITY DEFINER` e gravam em `audit_log` antes de
 * responder, com quem chamou e quantos registros a varredura alcançou. O acesso
 * é registrado mesmo sendo agregado — "quem consultou a base clínica, e com que
 * recorte" é pergunta legítima numa apuração.
 *
 * Emitir o mesmo evento aqui duplicaria a trilha e divergiria dela: o registro
 * do cliente ficava dentro do `queryFn`, então uma tela servida pelo cache não
 * gerava evento, e um refetch por foco de janela gerava um evento sem que
 * ninguém tivesse pedido nada. Auditoria cuja semântica muda com a política de
 * cache não é auditoria.
 */

export function useCruzamentoClinico(filtro: FiltroClinico) {
  return useQuery({
    queryKey: queryKeys.statistics.clinical(filtro),
    queryFn: async () => (await call(() => estatisticasClinicasApi.crossTab(filtro))).data,
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
