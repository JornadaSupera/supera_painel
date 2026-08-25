import { create } from "zustand";

import { DEFAULT_PAGE_SIZE, type Sort } from "@/services/contracts";

/**
 * Estado de cliente da listagem de profissionais.
 *
 * Mesmo desenho do store de Pacientes, e pelo mesmo motivo: abrir o histórico
 * de acessos de alguém e voltar não deve descartar o recorte da lista.
 */

export interface FiltrosUsuarios {
  [campo: string]: string;
  papel: string;
  especialidade: string;
  status: string;
}

export const FILTROS_VAZIOS: FiltrosUsuarios = {
  papel: "",
  especialidade: "",
  status: "",
};

interface UsuariosState {
  busca: string;
  filtros: FiltrosUsuarios;
  sort: Sort | null;
  page: number;
  pageSize: number;

  setBusca: (busca: string) => void;
  setFiltro: (campo: keyof FiltrosUsuarios, valor: string) => void;
  limparFiltros: () => void;
  setSort: (sort: Sort) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export const useUsuariosStore = create<UsuariosState>()((set) => ({
  busca: "",
  filtros: FILTROS_VAZIOS,
  // O protótipo lista a equipe por especialidade e, dentro dela, por nome.
  // Ordenar por nome é o mais próximo disso que uma coluna só permite.
  sort: { field: "nome", direction: "asc" },
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

export function temRecorte(busca: string, filtros: FiltrosUsuarios): boolean {
  return Boolean(busca.trim()) || Object.values(filtros).some(Boolean);
}
