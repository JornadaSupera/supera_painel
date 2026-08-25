import { create } from "zustand";

import { DEFAULT_PAGE_SIZE, type Sort } from "@/services/contracts";

/**
 * Estado de CLIENTE da listagem de pacientes: busca, filtros, ordenação e
 * página.
 *
 * Fica num store, e não em `useState` da página, para que abrir a ficha de um
 * paciente e voltar não jogue fora o recorte que a pessoa montou — em uma base
 * de 81 fichas isso já incomoda; com milhares, inviabiliza o trabalho.
 *
 * > [!] Nenhuma resposta de API entra aqui.
 * Zustand guarda o que a pessoa escolheu; o dado devolvido pelo servidor é do
 * TanStack Query. Misturar os dois é como o cache passa a mentir.
 *
 * Não é persistido: um filtro por "risco alto" restaurado dias depois, sem
 * contexto, leva a conclusão errada sobre a base.
 */

/**
 * Índice de string no tipo de propósito: os filtros são enviados como
 * `ListParams.filters`, cujas chaves viram nomes de coluna no `.eq()`.
 */
export interface FiltrosPacientes {
  [campo: string]: string;
  protocolo_id: string;
  cid: string;
  fase: string;
  risco: string;
  status: string;
}

export const FILTROS_VAZIOS: FiltrosPacientes = {
  protocolo_id: "",
  cid: "",
  fase: "",
  risco: "",
  status: "",
};

interface PacientesState {
  busca: string;
  filtros: FiltrosPacientes;
  sort: Sort | null;
  page: number;
  pageSize: number;

  setBusca: (busca: string) => void;
  setFiltro: (campo: keyof FiltrosPacientes, valor: string) => void;
  limparFiltros: () => void;
  setSort: (sort: Sort) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export const usePacientesStore = create<PacientesState>()((set) => ({
  busca: "",
  filtros: FILTROS_VAZIOS,
  // O protótipo lista do cadastro mais recente para o mais antigo.
  sort: { field: "criado_em", direction: "desc" },
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,

  // Qualquer mudança de recorte volta para a página 1: continuar na página 4 de
  // um resultado que agora tem 2 páginas mostra uma lista vazia sem explicação.
  setBusca: (busca) => set({ busca, page: 1 }),
  setFiltro: (campo, valor) =>
    set((estado) => ({ filtros: { ...estado.filtros, [campo]: valor }, page: 1 })),
  limparFiltros: () => set({ filtros: FILTROS_VAZIOS, busca: "", page: 1 }),
  setSort: (sort) => set({ sort, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
}));

/** Verdadeiro quando há qualquer recorte aplicado — muda a copy do estado vazio. */
export function temRecorte(busca: string, filtros: FiltrosPacientes): boolean {
  return Boolean(busca.trim()) || Object.values(filtros).some(Boolean);
}
