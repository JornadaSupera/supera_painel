import { useQuery } from "@tanstack/react-query";

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
