import { useQuery } from "@tanstack/react-query";

import { toListQuery } from "@/hooks/listQuery";
import { queryKeys } from "@/lib/queryKeys";
import { call, pacientesApi } from "@/services/apiClient";

/**
 * Carteira de pacientes, do lado do painel clínico.
 *
 * Reaproveita `pacientes.list` — a mesma leitura do administrativo
 * (`read_patient_list`), com busca própria e sem o store de filtros do
 * administrativo: aqui não há painel de filtros, e compartilhar aquele store
 * faria a busca de uma tela vazar para a outra.
 */
export function useMeusPacientes(busca: string) {
  const params = {
    page: 1,
    pageSize: 30,
    search: busca || undefined,
    sort: { field: "nome", direction: "asc" as const },
  };

  const query = useQuery({
    queryKey: queryKeys.patients.list(params),
    queryFn: () => call(() => pacientesApi.list(params)),
    placeholderData: (anterior) => anterior,
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, pacientes: items };
}
