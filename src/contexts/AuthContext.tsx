import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { audit } from "@/lib/audit";
import { SESSION } from "@/lib/env";
import { can, canAny, resolverPermissoes, type Permissao } from "@/lib/rbac";
import { authApi, call } from "@/services/apiClient";
import type { DesafioMfa, Sessao } from "@/types/auth";
import { AuthContext, type AuthContextValue, type LogoutReason } from "./auth-context";

/**
 * Authentication provider.
 *
 * The session lives **in memory only**. Neither `localStorage` nor
 * `sessionStorage`: any script on the page can read those, including an XSS
 * coming through the content editor. The price is that reloading the page
 * drops the session — intended behaviour at this stage. Once Supabase is in
 * place it restores the session from an `httpOnly` cookie, which JavaScript
 * cannot read.
 */

const ONE_MINUTE = 60_000;
/** How often the idle clock is checked. */
const TICK_INTERVAL = 15_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Sessao | null>(null);
  const [mfaChallenge, setMfaChallenge] = useState<DesafioMfa | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [secondsUntilExpiry, setSecondsUntilExpiry] = useState<number | null>(null);

  /** A ref, not state: it updates on every mouse move and must not rerender. */
  const lastActivity = useRef(Date.now());

  /* ------------------------------------------------------------- restore */

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const { data } = await call(() => authApi.getSession());
        if (active && data) {
          setSession(data);
          lastActivity.current = Date.now();
        }
      } catch {
        // Having no restorable session is the normal path while the backend
        // does not exist — not an error the user needs to see.
      } finally {
        if (active) setIsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  /* ------------------------------------------------------------- actions */

  const renewActivity = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  const signOut = useCallback(
    async (reason: LogoutReason = "user") => {
      const userId = session?.usuario.id;

      setSession(null);
      setMfaChallenge(null);
      setSecondsUntilExpiry(null);

      if (userId) audit.logout(userId, reason);

      try {
        await authApi.signOut();
      } catch {
        // Failing to tell the server must not block the local sign-out:
        // keeping the user signed in would be the worse of the two outcomes.
      }
    },
    [session],
  );

  const signIn = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const { data } = await call(() => authApi.signIn({ email, senha: password }));
    if (!data) throw new Error("Não foi possível iniciar o acesso.");

    // There is never a session at this step: the second factor is mandatory.
    setMfaChallenge(data.mfa);
  }, []);

  const confirmMfa = useCallback(
    async (code: string) => {
      if (!mfaChallenge) throw new Error("Nenhum acesso em andamento. Entre novamente.");

      const { data } = await call(() =>
        authApi.verifyMfa({ desafio_id: mfaChallenge.desafio_id, codigo: code }),
      );
      if (!data) throw new Error("Não foi possível concluir o acesso.");

      setSession(data);
      setMfaChallenge(null);
      lastActivity.current = Date.now();
      audit.login(data.usuario.id);
    },
    [mfaChallenge],
  );

  const cancelMfa = useCallback(() => setMfaChallenge(null), []);

  /* --------------------------------------------------------- permissions */

  const permissions = useMemo(() => {
    if (!session) return new Set<Permissao>();

    return resolverPermissoes({
      papel: session.usuario.papel,
      especialidade: session.usuario.especialidade,
      permissoesExtras: session.usuario.permissoes_extras,
    });
  }, [session]);

  const canDo = useCallback(
    (required: Permissao | readonly Permissao[]) => can(permissions, required),
    [permissions],
  );

  const canAnyOf = useCallback(
    (required: readonly Permissao[]) => canAny(permissions, required),
    [permissions],
  );

  /* ------------------------------------------------ idle and expiration */

  useEffect(() => {
    if (!session) return undefined;

    const events = ["pointerdown", "keydown", "scroll", "focus"] as const;
    const mark = () => renewActivity();

    events.forEach((event) => window.addEventListener(event, mark, { passive: true }));

    const timer = setInterval(() => {
      const idleLimit = SESSION.idleMinutes * ONE_MINUTE;
      const idleFor = Date.now() - lastActivity.current;
      const idleRemaining = idleLimit - idleFor;

      // The session has its own deadline too: the smaller of the two wins.
      const sessionRemaining = new Date(session.expira_em).getTime() - Date.now();
      const remaining = Math.min(idleRemaining, sessionRemaining);

      if (remaining <= 0) {
        void signOut(sessionRemaining <= 0 ? "session_expired" : "idle");
        return;
      }

      setSecondsUntilExpiry(Math.round(remaining / 1000));
    }, TICK_INTERVAL);

    return () => {
      events.forEach((event) => window.removeEventListener(event, mark));
      clearInterval(timer);
    };
  }, [session, signOut, renewActivity]);

  const isExpiringSoon =
    secondsUntilExpiry !== null && secondsUntilExpiry <= SESSION.warnMinutes * 60;

  /* ----------------------------------------------------------- the value */

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.usuario ?? null,
      permissions,
      isAuthenticated: Boolean(session),
      isLoading,
      mfaChallenge,
      signIn,
      confirmMfa,
      cancelMfa,
      signOut,
      can: canDo,
      canAny: canAnyOf,
      renewActivity,
      secondsUntilExpiry,
      isExpiringSoon,
    }),
    [
      session,
      permissions,
      isLoading,
      mfaChallenge,
      signIn,
      confirmMfa,
      cancelMfa,
      signOut,
      canDo,
      canAnyOf,
      renewActivity,
      secondsUntilExpiry,
      isExpiringSoon,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
