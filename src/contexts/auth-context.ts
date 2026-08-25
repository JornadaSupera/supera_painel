import { createContext, useContext } from "react";

import type { Permissao } from "@/lib/rbac";
import type { DesafioMfa, Sessao, UsuarioAutenticado } from "@/types/auth";

/**
 * Authentication context.
 *
 * Kept apart from the provider (`AuthContext.tsx`) so the component file
 * exports components only — a requirement of Vite's Fast Refresh.
 */

export interface AuthContextValue {
  /** `null` when there is no session. */
  session: Sessao | null;
  user: UsuarioAutenticado | null;
  /** Effective set — role + specialty + extras. See `lib/rbac.ts`. */
  permissions: ReadonlySet<Permissao>;
  isAuthenticated: boolean;
  /** True while the initial session restore is running. */
  isLoading: boolean;

  /** MFA challenge in progress; the `/login/mfa` screen depends on it. */
  mfaChallenge: DesafioMfa | null;

  signIn(params: { email: string; password: string }): Promise<void>;
  confirmMfa(code: string): Promise<void>;
  cancelMfa(): void;
  signOut(reason?: LogoutReason): Promise<void>;

  /** `can("pacientes:write")` — accepts one or many (logical AND). */
  can(permission: Permissao | readonly Permissao[]): boolean;
  /** True when at least one is held (logical OR). */
  canAny(permissions: readonly Permissao[]): boolean;

  /** Marks user activity, pushing the idle logout further out. */
  renewActivity(): void;
  /** Seconds left until the automatic logout; `null` without a session. */
  secondsUntilExpiry: number | null;
  /** True when little time is left and the warning should appear. */
  isExpiringSoon: boolean;
}

export type LogoutReason = "user" | "idle" | "session_expired";

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  }
  return context;
}

/** Shortcut for when only the permission check matters. */
export function useCan() {
  return useAuth().can;
}
