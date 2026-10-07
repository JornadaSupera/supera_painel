import type { Papel } from "@/lib/enums";
import {
  INDISPONIVEIS as INDISPONIVEIS_SUPABASE,
  INDISPONIVEIS_POR_PAPEL as INDISPONIVEIS_POR_PAPEL_SUPABASE,
  supabaseAdapter,
} from "./adapters/supabase";
import { throwIfError, type ApiError } from "./contracts";
import type {
  AprovacoesOperations,
  AuditoriaOperations,
  AuthOperations,
  CatalogosOperations,
  ClinicoOperations,
  ConfiguracoesOperations,
  ConteudosOperations,
  DashboardOperations,
  EstatisticasClinicasOperations,
  EstatisticasOperacionaisOperations,
  PacientesOperations,
  RelatoriosOperations,
  SatisfacaoOperations,
  PermissoesOperations,
  UsuariosOperations,
} from "./contracts/operations";

/**
 * apiClient — ÚNICO ponto de entrada de dados do painel.
 * =============================================================================
 * Nenhuma página, componente ou hook fala com `supabase` diretamente. Todos
 * falam com este arquivo. O ESLint recusa o contrário.
 *
 * Não existe adapter de mentira: o painel lê e escreve no banco, e quando o
 * banco não responde a tela mostra o erro, em vez de inventar um dado.
 */

const adapter = supabaseAdapter;

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

const indisponiveis = INDISPONIVEIS_SUPABASE;
const indisponiveisPorPapel = INDISPONIVEIS_POR_PAPEL_SUPABASE;

/**
 * `"pacientes.create"` → motivo, ou `null` quando a operação está disponível.
 *
 * Com `papel`, inclui o que o backend recusa só a esse papel. Nas telas, use
 * `useMotivoIndisponivel`, que já passa o papel da sessão.
 */
export function motivoIndisponivel(operacao: string, papel?: Papel): string | null {
  return (
    indisponiveis[operacao] ?? (papel ? indisponiveisPorPapel[operacao]?.[papel] : null) ?? null
  );
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

   O `as unknown as` abaixo era o elo fraco: ele fazia o consumidor confiar numa
   assinatura garantida só por coerção, e o adapter podia divergir do
   contrato em parâmetro ou em retorno sem que nada reclamasse. A coerção continua — é o
   preço de montar o adapter em runtime —, mas agora ela é **verificada na
   origem**: cada adapter aplica `satisfies PartialAdapterModules` no próprio
   bloco `implemented`, então uma divergência falha na compilação do adapter,
   antes de chegar aqui.
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
export const clinicoApi = api.clinico as unknown as ClinicoOperations;
export const estatisticasClinicasApi = api.estatisticasClinicas as unknown as EstatisticasClinicasOperations;
export const estatisticasOperacionaisApi = api.estatisticasOperacionais as unknown as EstatisticasOperacionaisOperations;
export const configuracoesApi = api.configuracoes as unknown as ConfiguracoesOperations;
export const relatoriosApi = api.relatorios as unknown as RelatoriosOperations;
export const satisfacaoApi = api.satisfacao as unknown as SatisfacaoOperations;

export default api;
