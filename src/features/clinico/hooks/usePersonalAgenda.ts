import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { audit } from "@/lib/audit";
import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";
import type { PersonalBlockInput } from "@/types/agenda";

/**
 * The parts of the professional's calendar that are not appointments: the
 * clinic's opening hours, the kinds of appointment to filter by, and the blocks
 * the professional makes for themselves.
 */

/** Opening hours and kinds change when someone edits the settings, not while a day is open. */
const STATIC_STALE_TIME = 10 * 60_000;

export function useBusinessHours() {
  return useQuery({
    queryKey: queryKeys.clinico.businessHours(),
    queryFn: async () => (await call(() => clinicoApi.listBusinessHours())).data,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useAppointmentTypes() {
  return useQuery({
    queryKey: queryKeys.clinico.appointmentTypes(),
    queryFn: async () => (await call(() => clinicoApi.listAppointmentTypes())).data,
    staleTime: STATIC_STALE_TIME,
  });
}

export function useMyBlocks(window: { from: string; to: string }) {
  return useQuery({
    queryKey: queryKeys.clinico.blocksIn(window.from, window.to),
    queryFn: async () => (await call(() => clinicoApi.listMyBlocks(window))).data,
  });
}

/**
 * A block is the professional's own agenda and, for whoever books, a busy
 * window (`read_professional_busy_intervals` reads blocks): both must refresh.
 */
function useRefreshBlocks() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.clinico.blocks() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.clinico.busyAll() }),
    ]);
}

export function useSaveBlock() {
  const refresh = useRefreshBlocks();

  return useMutation({
    mutationFn: async (params: PersonalBlockInput & { id?: string }) => {
      const { id, ...input } = params;
      const result = id
        ? await call(() => clinicoApi.updateBlock({ id, ...input }))
        : await call(() => clinicoApi.createBlock(input));
      return result.data;
    },
    onSuccess: async (saved, params) => {
      if (saved) audit.update("professional_blocks", saved.id, { operation: params.id ? "update" : "create" });
      await refresh();
      toast.success(params.id ? "Bloqueio atualizado" : "Horário bloqueado");

      // The block is accepted where appointments already are, and none is
      // cancelled. Say so, or the person reads the block as having cleared them.
      const conflicts = saved?.conflicts.length ?? 0;
      if (conflicts > 0) {
        toast.warning(
          conflicts === 1
            ? "Você tem 1 compromisso neste intervalo"
            : `Você tem ${conflicts} compromissos neste intervalo`,
          { description: "Eles continuam marcados. Remarque ou cancele pela agenda." },
        );
      }
    },
    onError: (error) => toast.error("Não foi possível salvar o bloqueio", { description: error.message }),
  });
}

export function useDeleteBlock() {
  const refresh = useRefreshBlocks();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.deleteBlock({ id }))).data,
    onSuccess: async (_data, id) => {
      audit.delete("professional_blocks", id, "Bloqueio removido pelo próprio profissional");
      await refresh();
      toast.success("Bloqueio removido");
    },
    onError: (error) => toast.error("Não foi possível remover o bloqueio", { description: error.message }),
  });
}
