import { create } from "zustand";

import { createListSlice, type ListState } from "./listStore";

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

export const useConteudosStore = create<ListState<FiltrosConteudos>>()((set) =>
  createListSlice(set, {
    emptyFilters: FILTROS_VAZIOS,
    // O protótipo agrupa os publicados por área e, dentro dela, mantém a ordem de
    // entrada. Ordenar pelo título é o mais próximo disso numa tabela ordenável.
    sort: { field: "titulo", direction: "asc" },
  }),
);
