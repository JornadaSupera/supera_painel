import { create } from "zustand";

import { createListSlice, type ListState } from "./listStore";

/**
 * Estado de CLIENTE da listagem de pacientes: busca, filtros, ordenação e
 * página. O desenho é o de `createListSlice`.
 *
 * Em uma base de 81 fichas perder o recorte ao abrir uma ficha já incomoda;
 * com milhares, inviabiliza o trabalho.
 *
 * Não é persistido: um filtro por "risco alto" restaurado dias depois, sem
 * contexto, leva a conclusão errada sobre a base.
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

export const usePacientesStore = create<ListState<FiltrosPacientes>>()((set) =>
  createListSlice(set, {
    emptyFilters: FILTROS_VAZIOS,
    // O protótipo lista do cadastro mais recente para o mais antigo.
    sort: { field: "criado_em", direction: "desc" },
  }),
);
