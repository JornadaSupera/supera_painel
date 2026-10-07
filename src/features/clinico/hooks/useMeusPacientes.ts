import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { toListQuery } from "@/hooks/listQuery";
import { useListParams } from "@/hooks/useListParams";
import { queryKeys } from "@/lib/queryKeys";
import { call, pacientesApi } from "@/services/apiClient";
import { useCarteiraStore } from "@/stores/clinicoPacientes";

/**
 * Carteira de pacientes, do lado do painel clínico.
 *
 * Reaproveita `pacientes.list` — a mesma leitura do administrativo
 * (`read_patient_list`) —, com o recorte do próprio painel: busca, protocolo,
 * CID, fase, situação, ordenação e página, todos resolvidos no servidor. O
 * store é o do painel clínico, não o do administrativo: o recorte de uma tela
 * não vaza para a outra.
 */
export function useMeusPacientes() {
  const params = useListParams(useCarteiraStore);

  const query = useQuery({
    queryKey: queryKeys.patients.list(params),
    queryFn: () => call(() => pacientesApi.list(params)),
    // Mantém a página anterior visível durante a troca: sem isso a lista pisca
    // para o esqueleto a cada clique.
    placeholderData: (anterior) => anterior,
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, pacientes: items, params };
}

/** The largest page the list reads at once. */
const SNAPSHOT_PAGE = { page: 1, pageSize: 200 } as const;

/**
 * Protocol, CID and phase of the active patients, by id — what a row of the day
 * needs beside the name. One audited list read for the whole day, instead of
 * three record reads per patient; a patient past the first 200 just shows
 * without the line.
 */
export function usePacientesPorId(enabled: boolean) {
  const query = useQuery({
    queryKey: queryKeys.patients.list(SNAPSHOT_PAGE),
    queryFn: () => call(() => pacientesApi.list(SNAPSHOT_PAGE)),
    enabled,
    staleTime: 5 * 60_000,
  });

  const porId = useMemo(
    () => new Map((query.data?.data ?? []).map((paciente) => [paciente.id, paciente])),
    [query.data],
  );

  return { ...query, porId };
}
