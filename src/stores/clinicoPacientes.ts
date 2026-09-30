import { create } from "zustand";

import { createListSlice, type ListState } from "./listStore";

/**
 * Estado de CLIENTE da carteira de pacientes do painel clínico: busca, filtros,
 * ordenação e página.
 *
 * É um store próprio, e não o da listagem administrativa: os dois painéis leem a
 * mesma lista, mas o recorte que um profissional montou não deve aparecer quando
 * a mesma pessoa abre a outra tela. Sem filtro por risco: não há fonte para ele.
 */

export interface FiltrosCarteira {
  [campo: string]: string;
  protocolo_id: string;
  cid: string;
  fase: string;
  status: string;
}

export const FILTROS_CARTEIRA_VAZIOS: FiltrosCarteira = {
  protocolo_id: "",
  cid: "",
  fase: "",
  status: "",
};

export const useCarteiraStore = create<ListState<FiltrosCarteira>>()((set) =>
  createListSlice(set, {
    emptyFilters: FILTROS_CARTEIRA_VAZIOS,
    // Quem procura um paciente procura por nome.
    sort: { field: "nome", direction: "asc" },
  }),
);
