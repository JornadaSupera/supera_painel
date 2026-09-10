import { create } from "zustand";

import { DEFAULT_PAGE_SIZE, type DateRange, type Sort } from "@/services/contracts";

/**
 * Estado de cliente da trilha de auditoria.
 *
 * Além da busca e dos filtros, guarda a JANELA de tempo — que aqui não é
 * enfeite: a trilha só cresce, e sem recorte temporal a tela pediria cinco anos
 * de registro para mostrar vinte linhas.
 */

export interface FiltrosAuditoria {
  [campo: string]: string;
  acao: string;
  usuario_id: string;
  paciente_id: string;
}

export const FILTROS_VAZIOS: FiltrosAuditoria = {
  acao: "",
  usuario_id: "",
  paciente_id: "",
};

/** Janelas oferecidas na tela, em dias. */
export const JANELAS = [
  { value: "1", label: "Últimas 24 horas" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "", label: "Todo o período" },
] as const;

interface AuditoriaState {
  busca: string;
  filtros: FiltrosAuditoria;
  /** Dias para trás; string vazia = sem recorte. */
  janelaDias: string;
  sort: Sort | null;
  page: number;
  pageSize: number;

  setBusca: (busca: string) => void;
  setFiltro: (campo: keyof FiltrosAuditoria, valor: string) => void;
  setJanela: (dias: string) => void;
  limparFiltros: () => void;
  setSort: (sort: Sort) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

export const useAuditoriaStore = create<AuditoriaState>()((set) => ({
  busca: "",
  filtros: FILTROS_VAZIOS,
  // Trinta dias é o recorte que mostra atividade real sem puxar a tabela
  // inteira. O protótipo abre em "atividade recente", que é a mesma ideia.
  janelaDias: "30",
  sort: { field: "criado_em", direction: "desc" },
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,

  setBusca: (busca) => set({ busca, page: 1 }),
  setFiltro: (campo, valor) =>
    set((estado) => ({ filtros: { ...estado.filtros, [campo]: valor }, page: 1 })),
  setJanela: (janelaDias) => set({ janelaDias, page: 1 }),
  limparFiltros: () => set({ filtros: FILTROS_VAZIOS, busca: "", janelaDias: "30", page: 1 }),
  setSort: (sort) => set({ sort, page: 1 }),
  setPage: (page) => set({ page }),
  setPageSize: (pageSize) => set({ pageSize, page: 1 }),
}));

export function temRecorte(busca: string, filtros: FiltrosAuditoria): boolean {
  return Boolean(busca.trim()) || Object.values(filtros).some(Boolean);
}

const UM_MINUTO = 60_000;
const UM_DIA = 86_400_000;

/**
 * A janela escolhida como intervalo ISO, ou `null` para "todo o período".
 *
 * > [!] O instante é arredondado para o minuto, e isso NÃO é cosmético.
 * Este intervalo entra na CHAVE de cache das consultas da trilha. Com precisão
 * de milissegundo, `to` mudava a cada chamada — e como a função é chamada no
 * corpo do componente, cada render produzia uma chave nova. O ciclo se
 * fechava sozinho: a resposta provocava um render, o render provocava uma
 * chave nova, a chave nova provocava outra consulta. A tela relia a trilha
 * indefinidamente, e o sintoma era invisível porque `placeholderData` mantinha
 * os dados anteriores na tela enquanto isso acontecia.
 *
 * Arredondar estabiliza a chave por até um minuto. Para uma trilha com
 * retenção de cinco anos, um minuto de defasagem no limite superior não muda
 * resposta nenhuma — e `to` fica no fim do minuto corrente, para que o registro
 * de agora há pouco continue dentro da janela.
 */
export function janelaComoRange(janelaDias: string): DateRange | null {
  const dias = Number(janelaDias);
  if (!dias || Number.isNaN(dias)) return null;

  const agora = Math.floor(Date.now() / UM_MINUTO) * UM_MINUTO;

  return {
    from: new Date(agora - dias * UM_DIA).toISOString(),
    to: new Date(agora + UM_MINUTO).toISOString(),
  };
}
