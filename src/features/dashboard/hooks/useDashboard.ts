import { useQuery } from "@tanstack/react-query";

import type { Periodo } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { call, dashboardApi } from "@/services/apiClient";

/**
 * Dados do painel executivo.
 *
 * Duas consultas separadas de propósito: os KPIs são leves e devem aparecer
 * primeiro, enquanto as séries dos gráficos são maiores. Numa única consulta, a
 * tela inteira esperaria pela parte mais lenta.
 */

/** O protótipo declara atualização em tempo real; 60 s é o suficiente. */
const INTERVALO_ATUALIZACAO = 60_000;

export function useKpis(periodo: Periodo) {
  return useQuery({
    queryKey: queryKeys.dashboard.kpis(periodo),
    queryFn: async () => {
      const { data } = await call(() => dashboardApi.getKpis({ periodo }));
      return data;
    },
    // Fase 15: trocar por subscription do Supabase Realtime — a chave de cache
    // e o formato do dado continuam os mesmos.
    refetchInterval: INTERVALO_ATUALIZACAO,
  });
}

export function useSeries(periodo: Periodo) {
  return useQuery({
    queryKey: queryKeys.dashboard.series("todas", periodo),
    queryFn: async () => {
      const { data } = await call(() => dashboardApi.getSeries({ periodo }));
      return data;
    },
    refetchInterval: INTERVALO_ATUALIZACAO,
  });
}
