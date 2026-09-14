import type { ListParams } from "@/services/contracts";
import type { ListFilters, ListState } from "@/stores/listStore";
import { useDebouncedValue } from "./useDebouncedValue";

/**
 * The `ListParams` a listing store describes, ready to go into a query key.
 *
 * The search is delayed; the filters are not — picking a <Select> option is a
 * decision, and waiting after it feels like the screen froze.
 *
 *   const params = useListParams(usePatientsStore);
 *   useQuery({ queryKey: queryKeys.patients.list(params), ... })
 */
export function useListParams<F extends ListFilters>(
  // Only the selector form is needed, which lets stores that extend the
  // listing slice (the audit trail's time window) pass straight in.
  useStore: <T>(selector: (state: ListState<F>) => T) => T,
): ListParams {
  const busca = useStore((state) => state.busca);
  const filtros = useStore((state) => state.filtros);
  const sort = useStore((state) => state.sort);
  const page = useStore((state) => state.page);
  const pageSize = useStore((state) => state.pageSize);

  const buscaAtrasada = useDebouncedValue(busca);

  return {
    page,
    pageSize,
    sort,
    search: buscaAtrasada,
    filters: filtros,
  };
}
