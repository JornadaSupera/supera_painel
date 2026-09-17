import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { audit, setAuditActor } from "@/lib/audit";
import { SESSION, SESSION_EXPIRES } from "@/lib/env";
import { can, canAny, resolverPermissoes, type Permissao } from "@/lib/rbac";
import { authApi, call } from "@/services/apiClient";
import type { DesafioMfa, Sessao } from "@/types/auth";
import { AuthContext, type AuthContextValue, type LogoutReason } from "./auth-context";
import { SessionClockContext, type SessionClockValue } from "./session-clock";

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
  const queryClient = useQueryClient();
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
          setAuditActor({ id: data.usuario.id, name: data.usuario.nome });
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

  /**
   * Drops every cached answer that belonged to the previous identity.
   *
   * The `QueryClient` is created once per mount of the SPA, and its keys carry
   * no user: without this, a second account signing in on the same tab would be
   * served the first account's patients, audit trail, users and permissions
   * straight from the cache — fresh, so not even refetched. It is an
   * authorization boundary, not a tidiness measure.
   *
   * Cancel first, then clear: a request already in flight resolves after the
   * clear and would repopulate the cache it was supposed to leave behind.
   */
  const discardCachedIdentity = useCallback(async () => {
    try {
      await queryClient.cancelQueries();
    } finally {
      // Clears queries AND mutations. Runs even if a cancellation throws —
      // leaving the previous identity's data behind is the worse outcome.
      queryClient.clear();
    }
  }, [queryClient]);

  const signOut = useCallback(
    async (reason: LogoutReason = "user") => {
      const userId = session?.usuario.id;

      setSession(null);
      setMfaChallenge(null);
      setSecondsUntilExpiry(null);

      await discardCachedIdentity();

      if (userId) audit.logout(userId, reason);

      // After the logout event, not before: the event itself belongs to whoever
      // was signed in.
      setAuditActor(null);

      try {
        await authApi.signOut();
      } catch {
        // Failing to tell the server must not block the local sign-out:
        // keeping the user signed in would be the worse of the two outcomes.
      }
    },
    [session, discardCachedIdentity],
  );

  const signIn = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const { data } = await call(() => authApi.signIn({ email, senha: password }));
      if (!data) throw new Error("Não foi possível iniciar o acesso.");

      // Sign-in ends in one of two places: the second factor screen, or the
      // panel. Which one is the data layer's call, not this component's.
      if (data.sessao) {
        // The other end of the boundary: signing in without a sign-out in
        // between (a second account on the same tab) must not inherit the cache.
        await discardCachedIdentity();
        setSession(data.sessao);
        setMfaChallenge(null);
        lastActivity.current = Date.now();
        setAuditActor({ id: data.sessao.usuario.id, name: data.sessao.usuario.nome });
        audit.login(data.sessao.usuario.id);
        return;
      }

      setMfaChallenge(data.mfa);
    },
    [discardCachedIdentity],
  );

  const confirmMfa = useCallback(
    async (code: string) => {
      if (!mfaChallenge) throw new Error("Nenhum acesso em andamento. Entre novamente.");

      const { data } = await call(() =>
        authApi.verifyMfa({ desafio_id: mfaChallenge.desafio_id, codigo: code }),
      );
      if (!data) throw new Error("Não foi possível concluir o acesso.");

      await discardCachedIdentity();
      setSession(data);
      setMfaChallenge(null);
      lastActivity.current = Date.now();
      setAuditActor({ id: data.usuario.id, name: data.usuario.nome });
      audit.login(data.usuario.id);
    },
    [mfaChallenge, discardCachedIdentity],
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

    /*
     * Relógio desligado (`VITE_SESSION_IDLE_MINUTES=0`): nem inatividade nem
     * prazo do token encerram a sessão.
     *
     * Vale notar para quando voltar a ligar: `expira_em` é a validade do token
     * no instante do login, e o cliente do Supabase renova o token sozinho.
     * Comparar esse retrato com o relógio derruba uma sessão que continua
     * válida no servidor — ao reativar, o prazo precisa ser relido, não
     * tratado como definitivo.
     */
    if (!SESSION_EXPIRES) {
      setSecondsUntilExpiry(null);
      return undefined;
    }

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

  /* ----------------------------------------------------------- the values */

  /*
   * TWO contexts, and the split is not tidiness.
   *
   * The clock ticks every fifteen seconds. With the countdown on the same value
   * as the permissions, every tick rerendered every consumer of `useAuth()` —
   * the route guards, every `<Can>` in the tree, the sidebar, the topbar — none
   * of which read it. Now only the expiry warning subscribes to the clock, and
   * `useAuth()` changes when authentication changes.
   */
  const clock = useMemo<SessionClockValue>(
    () => ({
      secondsUntilExpiry,
      isExpiringSoon:
        secondsUntilExpiry !== null && secondsUntilExpiry <= SESSION.warnMinutes * 60,
    }),
    [secondsUntilExpiry],
  );

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
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <SessionClockContext.Provider value={clock}>{children}</SessionClockContext.Provider>
    </AuthContext.Provider>
  );
}

export default AuthProvider;
