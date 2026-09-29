import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";

/** A fila de conversas — toda a equipe vê a mesma lista. Ver `clinico.listConversas`. */
export function useConversasClinicas() {
  return useQuery({
    queryKey: queryKeys.clinico.conversas(),
    queryFn: async () => (await call(() => clinicoApi.listConversas())).data,
    refetchInterval: 60_000,
  });
}

export function useMensagensClinicas(conversaId: string | null) {
  return useQuery({
    queryKey: queryKeys.clinico.mensagens(conversaId ?? ""),
    enabled: Boolean(conversaId),
    queryFn: async () =>
      (await call(() => clinicoApi.listMensagens({ conversaId: conversaId as string }))).data,
  });
}

function useInvalidarConversas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.clinico.all });
}

export function useAssumirConversa() {
  const invalidar = useInvalidarConversas();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.assumirConversa({ id }))).data,
    onSuccess: async () => {
      await invalidar();
      toast.success("Conversa assumida");
    },
    onError: (erro) => toast.error("Não foi possível assumir a conversa", { description: erro.message }),
  });
}

export function useResolverConversa() {
  const invalidar = useInvalidarConversas();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.resolverConversa({ id }))).data,
    onSuccess: async () => {
      await invalidar();
      toast.success("Conversa marcada como resolvida");
    },
    onError: (erro) => toast.error("Não foi possível resolver a conversa", { description: erro.message }),
  });
}

/** Silenciosa de propósito: marcar como lida não deve interromper quem está lendo. */
export function useMarcarConversaLida() {
  const invalidar = useInvalidarConversas();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.marcarConversaLida({ id }))).data,
    onSuccess: () => void invalidar(),
  });
}
