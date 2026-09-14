import { create } from "zustand";

import { createListSlice, type ListState } from "./listStore";

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

export const useUsuariosStore = create<ListState<FiltrosUsuarios>>()((set) =>
  createListSlice(set, {
    emptyFilters: FILTROS_VAZIOS,
    // O protótipo lista a equipe por especialidade e, dentro dela, por nome.
    // Ordenar por nome é o mais próximo disso que uma coluna só permite.
    sort: { field: "nome", direction: "asc" },
  }),
);
