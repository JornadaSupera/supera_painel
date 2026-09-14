import { DEFAULT_PAGE_SIZE, type Sort } from "@/services/contracts";

/**
 * The client state every listing shares: search, filters, sort and page.
 *
 * It lives in a store, not in page `useState`, so opening a record and coming
 * back does not throw away the slice the person built.
 *
 * > [!] No API response goes in here.
 * Zustand holds what the person chose; what the server returned belongs to
 * TanStack Query. Mixing the two is how the cache starts lying.
 *
 * Not persisted: a filter restored days later, with no context, leads to the
 * wrong conclusion about the base.
 */

/**
 * String index on purpose: filters are sent as `ListParams.filters`, whose keys
 * become column names in `.eq()`.
 */
export type ListFilters = Record<string, string>;

export interface ListState<F extends ListFilters> {
  busca: string;
  filtros: F;
  sort: Sort | null;
  page: number;
  pageSize: number;

  setBusca: (busca: string) => void;
  setFiltro: (campo: keyof F, valor: string) => void;
  limparFiltros: () => void;
  setSort: (sort: Sort) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

type SetListState<F extends ListFilters> = (
  partial: Partial<ListState<F>> | ((state: ListState<F>) => Partial<ListState<F>>),
) => void;

/**
 * The listing slice, ready to spread into a store:
 *
 *   create<UsersState>()((set) => ({ ...createListSlice(set, { ... }) }))
 *
 * Any change to the slice goes back to page 1: staying on page 4 of a result
 * that now has 2 pages shows an empty list with no explanation.
 */
export function createListSlice<F extends ListFilters>(
  set: SetListState<F>,
  { emptyFilters, sort }: { emptyFilters: F; sort: Sort },
): ListState<F> {
  return {
    busca: "",
    filtros: emptyFilters,
    sort,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,

    setBusca: (busca) => set({ busca, page: 1 }),
    setFiltro: (campo, valor) =>
      set((state) => ({ filtros: { ...state.filtros, [campo]: valor }, page: 1 })),
    limparFiltros: () => set({ filtros: emptyFilters, busca: "", page: 1 }),
    setSort: (nextSort) => set({ sort: nextSort, page: 1 }),
    setPage: (page) => set({ page }),
    setPageSize: (pageSize) => set({ pageSize, page: 1 }),
  };
}

/** True when any search or filter is applied — it changes the empty-state copy. */
export function hasActiveFilters(busca: string, filtros: ListFilters): boolean {
  return Boolean(busca.trim()) || Object.values(filtros).some(Boolean);
}
