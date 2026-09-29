import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";

/** Um dia inteiro, do primeiro ao último instante, no fuso do navegador. */
export interface JanelaAgenda {
  de: string;
  ate: string;
}

/**
 * Compromissos do profissional logado numa janela — ver `clinico.getMinhaAgenda`.
 *
 * A janela é o parâmetro, não "hoje" fixo: o Dashboard pede o dia, a tela de
 * Agenda pede a semana, e as duas leem a mesma operação.
 */
export function useAgendaClinica(janela: JanelaAgenda) {
  return useQuery({
    queryKey: queryKeys.clinico.agenda(janela),
    queryFn: async () => (await call(() => clinicoApi.getMinhaAgenda(janela))).data,
    // O dia muda por ação de quem agenda, não só de quem está olhando.
    refetchInterval: 60_000,
  });
}
