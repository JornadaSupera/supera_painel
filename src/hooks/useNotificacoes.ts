import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/queryKeys";
import { call, notificacoesApi } from "@/services/apiClient";

/**
 * The bell's data. Polled, not live: a minute is close enough for an inbox, and
 * the queries pause with the tab in the background.
 */
const INTERVALO = 60_000;

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
