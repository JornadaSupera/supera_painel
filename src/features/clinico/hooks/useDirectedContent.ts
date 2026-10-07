import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { audit } from "@/lib/audit";
import type { Especialidade } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";

/**
 * Orientations sent straight to one patient: what was sent and opened, the
 * library an area sends from, and the send itself.
 *
 * The read is recorded by the database inside `read_content_directed_sends`, so
 * nothing here reports it. The send changes what reaches a patient's phone, so
 * it leaves its own entry in the trail.
 */

export function useDirectedSends(patientId: string) {
  return useQuery({
    queryKey: queryKeys.clinico.directedSends(patientId),
    queryFn: async () => (await call(() => clinicoApi.listDirectedSends({ patientId }))).data,
    // The patient opens what was sent while someone may be looking at the record.
    refetchInterval: 120_000,
  });
}

/** Only asked when the area can send: reading the library is no use to whoever only looks. */
export function useSendableContent(specialty: Especialidade, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.clinico.sendableContent(specialty),
    queryFn: async () => (await call(() => clinicoApi.listSendableContent({ specialty }))).data,
    enabled,
  });
}

export function useSendDirectedContent(patientId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { contentItemId: string; specialty: Especialidade; title: string }) =>
      (
        await call(() =>
          clinicoApi.sendDirectedContent({
            patientId,
            contentItemId: params.contentItemId,
            specialty: params.specialty,
          }),
        )
      ).data,
    onSuccess: async (data, params) => {
      if (data) {
        audit.update("content_directed_sends", data.send_id, {
          operation: "send",
          content_item_id: params.contentItemId,
        });
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.clinico.directedSends(patientId) });
      toast.success("Orientação enviada", {
        description: `“${params.title}” já está no app do paciente.`,
      });
    },
    onError: (error) => toast.error("Não foi possível enviar a orientação", { description: error.message }),
  });
}
