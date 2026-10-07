import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { audit } from "@/lib/audit";
import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";
import { useLerNotificacoesDaConversa } from "./useConversasClinicas";

/**
 * Handing a conversation to a colleague, and the history of who held it.
 *
 * Both reads are audited by the database, so they only run when the person opens
 * what needs them: the dialog for the colleague list, the history strip for the
 * assignments.
 */

export function useTransferTargets(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.clinico.transferTargets(),
    queryFn: async () => (await call(() => clinicoApi.listTransferTargets())).data,
    enabled,
    // The team changes rarely; asking again on every open would only add reads.
    staleTime: 5 * 60_000,
  });
}

export function useConversationAssignments(conversationId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.clinico.assignments(conversationId),
    queryFn: async () =>
      (await call(() => clinicoApi.listConversationAssignments({ conversationId }))).data,
    enabled,
  });
}

export function useTransferConversation() {
  const queryClient = useQueryClient();
  const lerNotificacoes = useLerNotificacoesDaConversa();

  return useMutation({
    mutationFn: async (params: { conversationId: string; toProfessionalId: string; toName: string }) =>
      (
        await call(() =>
          clinicoApi.transferConversation({
            conversationId: params.conversationId,
            toProfessionalId: params.toProfessionalId,
          }),
        )
      ).data,
    onSuccess: (_data, params) => {
      audit.update("conversations", params.conversationId, { operation: "transfer" });
      // Handing it on can happen from the queue, without opening it: what
      // announced it to this person is settled either way.
      lerNotificacoes(params.conversationId);
      // The conversation changes area, the queue changes, the history grows and
      // the patient gets a message: everything about the chat is stale. Not
      // awaited — the dialog should close now, not after the queue has reloaded.
      void queryClient.invalidateQueries({ queryKey: queryKeys.clinico.all });
      toast.success(`Conversa encaminhada para ${params.toName}`);
    },
    onError: (error) => toast.error("Não foi possível encaminhar", { description: error.message }),
  });
}
