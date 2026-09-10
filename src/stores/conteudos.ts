import { create } from "zustand";

import { DEFAULT_PAGE_SIZE, type Sort } from "@/services/contracts";

/**
 * Estado de cliente da biblioteca de conteúdo.
 *
 * O recorte vale para a lista de PUBLICADOS. A fila de revisão não é filtrada:
 * ela é curta por natureza e existe para ser esvaziada — esconder itens dela
 * atrás de um filtro é como perder de vista o que espera decisão.
 */

export interface FiltrosConteudos {
  [campo: string]: string;
  categoria_id: string;
  especialidade: string;
  tipo: string;
  status: string;
}

export const FILTROS_VAZIOS: FiltrosConteudos = {
  categoria_id: "",
  especialidade: "",
  tipo: "",
  status: "",
};

interface ConteudosState {
  busca: string;
  filtros: FiltrosConteudos;
  sort: Sort | null;
  page: number;
  pageSize: number;

  setBusca: (busca: string) => void;
  setFiltro: (campo: keyof FiltrosConteudos, valor: string) => void;
  limparFiltros: () => void;
  setSort: (sort: Sort) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export const useConteudosStore = create<ConteudosState>()((set) => ({
  busca: "",
  filtros: FILTROS_VAZIOS,
  // O protótipo agrupa os publicados por área e, dentro dela, mantém a ordem de
  // entrada. Ordenar pelo título é o mais próximo disso numa tabela ordenável.
  sort: { field: "titulo", direction: "asc" },
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,

  setBusca: (busca) => set({ busca, page: 1 }),
  setFiltro: (campo, valor) =>
    set((estado) => ({ filtros: { ...estado.filtros, [campo]: valor }, page: 1 })),
  limparFiltros: () => set({ filtros: FILTROS_VAZIOS, busca: "", page: 1 }),
  setSort: (sort) => set({ sort, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
}));

export function temRecorte(busca: string, filtros: FiltrosConteudos): boolean {
  return Boolean(busca.trim()) || Object.values(filtros).some(Boolean);
}
