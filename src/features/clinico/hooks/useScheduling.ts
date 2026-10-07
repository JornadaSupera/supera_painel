import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { audit } from "@/lib/audit";
import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi, pacientesApi } from "@/services/apiClient";
import type { AppointmentInput, AppointmentOutcome } from "@/types/agenda";

/**
 * Booking, moving and closing appointments.
 *
 * Whether the signed-in professional runs the schedule is asked once
 * (`useSchedulingAccess`) and only decides whether the buttons are drawn: the
 * database re-checks the grant on every write, so a stale answer can only draw a
 * button that then answers "no", never let something through.
 */

/** Who manages the schedule does not change inside a session. */
const ACCESS_STALE_TIME = 10 * 60_000;

export function useSchedulingAccess() {
  return useQuery({
    queryKey: queryKeys.clinico.schedulingAccess(),
    queryFn: async () => (await call(() => clinicoApi.getSchedulingAccess())).data,
    staleTime: ACCESS_STALE_TIME,
    // A failed probe is not "no": it is "unknown", and drawing no button on a
    // network blip would hide the feature until the next reload.
    retry: 1,
  });
}

/** When people on the team cannot take appointments. At most 62 days per window. */
export function useBusyIntervals(window: { from: string; to: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.clinico.busyIn(window.from, window.to),
    queryFn: async () => (await call(() => clinicoApi.listBusyIntervals(window))).data,
    enabled,
  });
}

/** Patients matching a typed name, code or document. Waits for two characters. */
export function usePatientSearch(term: string) {
  const debounced = useDebouncedValue(term.trim(), 300);

  return useQuery({
    queryKey: ["clinico", "patient-search", debounced] as const,
    enabled: debounced.length >= 2,
    queryFn: async () =>
      (await call(() => pacientesApi.list({ page: 1, pageSize: 8, search: debounced, filters: { status: "ativo" } })))
        .data,
  });
}

/**
 * What booking, moving or closing an appointment must refresh: the agenda and
 * what is counted from it — the day's panel and the patient's agenda tab (both
 * under the agenda key), the record's timeline, and the executive dashboard's
 * sessions. The bell is refreshed by the mutation cache.
 */
function useRefreshAgenda() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.clinico.agendaAll() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.clinico.records() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    ]);
  };
}

export function useScheduleAppointment() {
  const refresh = useRefreshAgenda();

  return useMutation({
    mutationFn: async (input: AppointmentInput) => (await call(() => clinicoApi.scheduleAppointment(input))).data,
    onSuccess: async (created, input) => {
      if (created) audit.update("appointments", created.id, { operation: "schedule", patient_id: input.patient_id });
      await refresh();
      toast.success("Compromisso marcado", { description: "O paciente é avisado pelo aplicativo." });
    },
    onError: (error) => toast.error("Não foi possível marcar", { description: error.message }),
  });
}

export function useRescheduleAppointment() {
  const refresh = useRefreshAgenda();

  return useMutation({
    mutationFn: async (params: { id: string; starts_at: string; ends_at: string }) =>
      (await call(() => clinicoApi.rescheduleAppointment(params))).data,
    onSuccess: async (moved, params) => {
      audit.update("appointments", params.id, { operation: "reschedule", new_id: moved?.id });
      await refresh();
      toast.success("Compromisso remarcado", { description: "O horário anterior ficou como remarcado." });
    },
    onError: (error) => toast.error("Não foi possível remarcar", { description: error.message }),
  });
}

const OUTCOME_TOAST: Record<AppointmentOutcome, string> = {
  completed: "Marcado como realizado",
  no_show: "Falta registrada",
  cancelled: "Compromisso cancelado",
};

export function useSetAppointmentStatus() {
  const refresh = useRefreshAgenda();

  return useMutation({
    mutationFn: async (params: { id: string; outcome: AppointmentOutcome; reason?: string }) =>
      (await call(() => clinicoApi.setAppointmentStatus({ id: params.id, outcome: params.outcome }))).data,
    onSuccess: async (_data, params) => {
      // The reason typed in the confirmation stays in the panel's trail: the
      // call has no field for it.
      audit.update("appointments", params.id, { operation: params.outcome, reason: params.reason });
      await refresh();
      toast.success(OUTCOME_TOAST[params.outcome]);
    },
    onError: (error) => toast.error("Não foi possível registrar", { description: error.message }),
  });
}
