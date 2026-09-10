import { API_MODE } from "@/lib/env";
import { INDISPONIVEIS as INDISPONIVEIS_MOCK, mockAdapter } from "./adapters/mock";
import { INDISPONIVEIS as INDISPONIVEIS_SUPABASE, supabaseAdapter } from "./adapters/supabase";
import { throwIfError, type ApiError } from "./contracts";
import type {
  AprovacoesOperations,
  AuditoriaOperations,
  AuthOperations,
  CatalogosOperations,
  ConfiguracoesOperations,
  ConteudosOperations,
  DashboardOperations,
  EstatisticasClinicasOperations,
  EstatisticasOperacionaisOperations,
  PacientesOperations,
  RelatoriosOperations,
  PermissoesOperations,
  UsuariosOperations,
} from "./contracts/operations";

/**
 * apiClient — ÚNICO ponto de entrada de dados do painel.
 * =============================================================================
 * Nenhuma página, componente ou hook fala com `mocks/` ou com `supabase`
 * diretamente. Todos falam com este arquivo. O ESLint recusa o contrário.
 *
 * A troca de backend (Fase 15) é literalmente a linha abaixo:
 *
 *     VITE_API_MODE=mock  →  VITE_API_MODE=supabase
 *
 * Nenhuma tela é tocada.
 */

const adapter = API_MODE === "supabase" ? supabaseAdapter : mockAdapter;

export const apiMode = API_MODE;

/**
 * Superfície pública. Espelha `RESOURCES`.
 *
 *   import { api } from "@/services/apiClient";
 *   api.pacientes.list({ page: 1 })
 */
export const api = adapter;

/* -------------------------------------------------------------------------
   O QUE O BACKEND EM USO NÃO EXECUTA
   -------------------------------------------------------------------------
   A interface consulta isto para desabilitar uma ação em vez de deixar a
   pessoa preencher um formulário e receber `permission denied` no fim. É a
   diferença entre um painel que explica e um que falha.

   A lista é do adapter, não da tela: quando o backend ganhar a operação, a
   linha some de um lugar só e todos os botões voltam sozinhos.
   ------------------------------------------------------------------------- */

const indisponiveis = API_MODE === "supabase" ? INDISPONIVEIS_SUPABASE : INDISPONIVEIS_MOCK;

/** `"pacientes.create"` → motivo, ou `null` quando a operação está disponível. */
export function motivoIndisponivel(operacao: string): string | null {
  return indisponiveis[operacao] ?? null;
}

export function operacaoDisponivel(operacao: string): boolean {
  return !(operacao in indisponiveis);
}

/**
 * Versão que lança em vez de devolver `{ error }` — é o formato que o TanStack
 * Query espera. Use nos hooks de query/mutation; use `api.*` quando quiser
 * tratar o erro na mão.
 *
 *   const { data, count } = await call(() => api.pacientes.list({ page: 1 }));
 */
export async function call<T extends { error: ApiError | null }>(
  operation: () => Promise<T>,
): Promise<T> {
  return throwIfError(await operation());
}

/* -------------------------------------------------------------------------
   FACHADAS TIPADAS
   `RESOURCES` é percorrido em runtime, então o tipo derivado dele é
   necessariamente genérico. Aqui cada recurso recebe sua assinatura concreta,
   declarada em `contracts/operations.ts`. É o único lugar do projeto onde essa
   conversão acontece — as telas consomem já tipado.
   ------------------------------------------------------------------------- */

export const authApi = api.auth as unknown as AuthOperations;
export const dashboardApi = api.dashboard as unknown as DashboardOperations;
export const pacientesApi = api.pacientes as unknown as PacientesOperations;
export const catalogosApi = api.catalogos as unknown as CatalogosOperations;
export const usuariosApi = api.usuarios as unknown as UsuariosOperations;
export const permissoesApi = api.permissoes as unknown as PermissoesOperations;
export const conteudosApi = api.conteudos as unknown as ConteudosOperations;
export const aprovacoesApi = api.aprovacoes as unknown as AprovacoesOperations;
export const auditoriaApi = api.auditoria as unknown as AuditoriaOperations;
export const estatisticasClinicasApi = api.estatisticasClinicas as unknown as EstatisticasClinicasOperations;
export const estatisticasOperacionaisApi = api.estatisticasOperacionais as unknown as EstatisticasOperacionaisOperations;
export const configuracoesApi = api.configuracoes as unknown as ConfiguracoesOperations;
export const relatoriosApi = api.relatorios as unknown as RelatoriosOperations;

export default api;
