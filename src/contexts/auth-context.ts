import { createContext, useContext } from "react";

import type { Permissao } from "@/lib/rbac";
import type { DesafioMfa, Sessao, UsuarioAutenticado } from "@/types/auth";

/**
 * Contexto de autenticação.
 *
 * Separado do provider (`AuthContext.tsx`) para que o arquivo do componente
 * exporte apenas componentes — requisito do Fast Refresh do Vite.
 */

export interface AuthContextValue {
  /** `null` quando não há sessão. */
  sessao: Sessao | null;
  usuario: UsuarioAutenticado | null;
  /** Conjunto efetivo — papel + especialidade + extras. Ver `lib/rbac.ts`. */
  permissoes: ReadonlySet<Permissao>;
  autenticado: boolean;
  /** Verdadeiro durante a restauração inicial da sessão. */
  carregando: boolean;

  /** Desafio de MFA em curso; a tela `/login/mfa` depende dele. */
  desafioMfa: DesafioMfa | null;

  entrar(params: { email: string; senha: string }): Promise<void>;
  confirmarMfa(codigo: string): Promise<void>;
  cancelarMfa(): void;
  sair(motivo?: MotivoLogout): Promise<void>;

  /** `can("pacientes:write")` — aceita uma ou várias (E lógico). */
  pode(permissao: Permissao | readonly Permissao[]): boolean;
  /** Verdadeiro se tiver ao menos uma (OU lógico). */
  podeAlguma(permissoes: readonly Permissao[]): boolean;

  /** Marca atividade do usuário, adiando o logout por inatividade. */
  renovarAtividade(): void;
  /** Segundos restantes até o logout automático; `null` sem sessão. */
  segundosParaExpirar: number | null;
  /** Verdadeiro quando falta pouco e o aviso deve aparecer. */
  expirandoEmBreve: boolean;
}

export type MotivoLogout = "usuario" | "inatividade" | "sessao_expirada";

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  }
  return context;
}

/** Atalho para quando só a checagem de permissão importa. */
export function usePode() {
  return useAuth().pode;
}
