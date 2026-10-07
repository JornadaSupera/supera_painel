import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/queryKeys";
import { REFRESH_MS } from "@/lib/refresh";
import { call, notificacoesApi } from "@/services/apiClient";

/**
 * The bell's data. Polled, not live: a minute is close enough for an inbox, and
 * the queries pause with the tab in the background. Any action taken in the
 * panel refreshes it at once — see the mutation cache in `app/providers`.
 */
const INTERVALO = REFRESH_MS.livre;

export function useNotificacoes(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: async () => (await call(() => notificacoesApi.list())).data,
    enabled,
    refetchInterval: INTERVALO,
  });
}

export function useNaoLidas() {
  return useQuery({
    queryKey: queryKeys.notifications.unread(),
    queryFn: async () => (await call(() => notificacoesApi.contarNaoLidas())).data,
    refetchInterval: INTERVALO,
  });
}

/**
 * Whose each notification in the open inbox is. Asked when the bell opens and
 * kept for minutes: a name does not change, and each one read is a line on the
 * audit trail, so the inbox rereading every minute does not ask again.
 */
export function useNomesDasNotificacoes(ids: string[], enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.patientNames(ids),
    queryFn: async () => (await call(() => notificacoesApi.nomesDosPacientes({ ids }))).data,
    enabled: enabled && ids.length > 0,
    staleTime: 5 * 60_000,
  });
}

/** The admin's queues. Off for everyone else: the counts would come back empty anyway. */
export function usePendenciasAdmin(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.notifications.pending(),
    queryFn: async () => (await call(() => notificacoesApi.getPendenciasAdmin())).data,
    enabled,
    refetchInterval: INTERVALO,
  });
}

export function useMarcarNotificacaoLida() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => notificacoesApi.marcarLida({ id }))).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
  });
}

export function useMarcarTodasLidas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => (await call(() => notificacoesApi.marcarTodasLidas())).data,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    onError: (erro) =>
      toast.error("Não foi possível marcar como lidas", { description: erro.message }),
  });
}
