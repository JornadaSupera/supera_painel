import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { audit } from "@/lib/audit";
import type { Especialidade } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { ApiException } from "@/services/contracts";
import { call, clinicoApi } from "@/services/apiClient";
import type { TimelineWindow } from "@/types/patient-record";

/**
 * The patient record: the timeline, the symptoms of a diary entry, and the two
 * writes a professional can make — a note and a distress flag.
 *
 * Reading is audited by the database inside each `read_*` function, so nothing
 * here reports a read (see `lib/audit`).
 */

export function usePatientTimeline(patientId: string, days: TimelineWindow) {
  return useQuery({
    queryKey: queryKeys.clinico.record(patientId, days),
    queryFn: async () => (await call(() => clinicoApi.getPatientTimeline({ patientId, days }))).data,
    // The team writes to the record while someone is reading it.
    refetchInterval: 120_000,
  });
}

/** Loaded when the entry is opened: it is one call per entry, and most are never opened. */
export function useDiarySymptoms(entryId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.clinico.diarySymptoms(entryId),
    queryFn: async () => (await call(() => clinicoApi.listDiarySymptoms({ entryId }))).data,
    enabled,
    staleTime: Infinity,
  });
}

function useRefreshRecord() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.clinico.records() });
}

/** The error says the note was written but the flag was not — refresh either way. */
export function noteWasSaved(error: unknown): boolean {
  return (
    error instanceof ApiException &&
    typeof error.details === "object" &&
    error.details !== null &&
    "noteSaved" in error.details
  );
}

export function useAddSpecialtyNote(patientId: string) {
  const refresh = useRefreshRecord();

  return useMutation({
    mutationFn: async (params: { specialty: Especialidade; body: string; flagDistress: boolean }) =>
      (await call(() => clinicoApi.addSpecialtyNote({ patientId, ...params }))).data,
    onSuccess: async (data, params) => {
      if (data) audit.update("specialty_notes", data.note_id, { flagged: params.flagDistress });
      await refresh();
      toast.success(params.flagDistress ? "Anotação salva e sofrimento sinalizado" : "Anotação salva");
    },
    onError: async (error) => {
      if (noteWasSaved(error)) await refresh();
      toast.error("Não foi possível salvar a anotação", { description: error.message });
    },
  });
}

export function useRaiseDistressFlag() {
  const refresh = useRefreshRecord();

  return useMutation({
    mutationFn: async (noteId: string) => (await call(() => clinicoApi.raiseDistressFlag({ noteId }))).data,
    onSuccess: async (_data, noteId) => {
      audit.update("specialty_flags", noteId, { operation: "distress" });
      await refresh();
      toast.success("Sofrimento sinalizado à equipe");
    },
    onError: (error) => toast.error("Não foi possível sinalizar", { description: error.message }),
  });
}
