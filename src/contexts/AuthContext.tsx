import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { auditar } from "@/lib/audit";
import { SESSION } from "@/lib/env";
import { can, canAny, resolverPermissoes, type Permissao } from "@/lib/rbac";
import { authApi, call } from "@/services/apiClient";
import type { DesafioMfa, Sessao } from "@/types/auth";
import { AuthContext, type AuthContextValue, type MotivoLogout } from "./auth-context";

/**
 * Provedor de autenticação.
 *
 * A sessão vive **apenas em memória**. Nem `localStorage` nem `sessionStorage`:
 * qualquer script da página lê esses armazenamentos, inclusive um XSS vindo do
 * editor de conteúdo. O preço é que recarregar a página derruba a sessão —
 * comportamento pretendido nesta fase. Na Fase 15 o Supabase restaura a sessão
 * a partir de um cookie `httpOnly`, que o JavaScript não consegue ler.
 */

const UM_MINUTO = 60_000;
/** De quanto em quanto tempo o relógio de inatividade é conferido. */
const INTERVALO_TICK = 15_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [desafioMfa, setDesafioMfa] = useState<DesafioMfa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [segundosParaExpirar, setSegundosParaExpirar] = useState<number | null>(null);

  /** Ref, e não state: atualiza a cada movimento do mouse e não deve rerenderizar. */
  const ultimaAtividade = useRef(Date.now());

  /* ---------------------------------------------------------- restauração */

  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        const { data } = await call(() => authApi.getSession());
        if (ativo && data) {
          setSessao(data);
          ultimaAtividade.current = Date.now();
        }
      } catch {
        // Sem sessão restaurável é o caminho normal enquanto o backend não
        // existe — não é erro que o usuário precise ver.
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  /* ---------------------------------------------------------------- ações */

  const renovarAtividade = useCallback(() => {
    ultimaAtividade.current = Date.now();
  }, []);

  const sair = useCallback(
    async (motivo: MotivoLogout = "usuario") => {
      const usuarioId = sessao?.usuario.id;

      setSessao(null);
      setDesafioMfa(null);
      setSegundosParaExpirar(null);

      if (usuarioId) auditar.logout(usuarioId, motivo);

      try {
        await authApi.signOut();
      } catch {
        // Falhar ao avisar o servidor não pode impedir a saída local:
        // manter o usuário conectado seria o pior dos dois resultados.
      }
    },
    [sessao],
  );

  const entrar = useCallback(async ({ email, senha }: { email: string; senha: string }) => {
    const { data } = await call(() => authApi.signIn({ email, senha }));
    if (!data) throw new Error("Não foi possível iniciar o acesso.");

    // Nunca há sessão nesta etapa: o segundo fator é obrigatório.
    setDesafioMfa(data.mfa);
  }, []);

  const confirmarMfa = useCallback(
    async (codigo: string) => {
      if (!desafioMfa) throw new Error("Nenhum acesso em andamento. Entre novamente.");

      const { data } = await call(() =>
        authApi.verifyMfa({ desafio_id: desafioMfa.desafio_id, codigo }),
      );
      if (!data) throw new Error("Não foi possível concluir o acesso.");

      setSessao(data);
      setDesafioMfa(null);
      ultimaAtividade.current = Date.now();
      auditar.login(data.usuario.id);
    },
    [desafioMfa],
  );

  const cancelarMfa = useCallback(() => setDesafioMfa(null), []);

  /* ------------------------------------------------------------ permissões */

  const permissoes = useMemo(() => {
    if (!sessao) return new Set<Permissao>();

    return resolverPermissoes({
      papel: sessao.usuario.papel,
      especialidade: sessao.usuario.especialidade,
      permissoesExtras: sessao.usuario.permissoes_extras,
    });
  }, [sessao]);

  const pode = useCallback(
    (requeridas: Permissao | readonly Permissao[]) => can(permissoes, requeridas),
    [permissoes],
  );

  const podeAlguma = useCallback(
    (requeridas: readonly Permissao[]) => canAny(permissoes, requeridas),
    [permissoes],
  );

  /* ---------------------------------------------- inatividade e expiração */

  useEffect(() => {
    if (!sessao) return undefined;

    const eventos = ["pointerdown", "keydown", "scroll", "focus"] as const;
    const marcar = () => renovarAtividade();

    eventos.forEach((evento) => window.addEventListener(evento, marcar, { passive: true }));

    const timer = setInterval(() => {
      const limiteInatividade = SESSION.idleMinutes * UM_MINUTO;
      const ocioso = Date.now() - ultimaAtividade.current;
      const restanteInatividade = limiteInatividade - ocioso;

      // A sessão também tem prazo próprio: o menor dos dois manda.
      const restanteSessao = new Date(sessao.expira_em).getTime() - Date.now();
      const restante = Math.min(restanteInatividade, restanteSessao);

      if (restante <= 0) {
        void sair(restanteSessao <= 0 ? "sessao_expirada" : "inatividade");
        return;
      }

      setSegundosParaExpirar(Math.round(restante / 1000));
    }, INTERVALO_TICK);

    return () => {
      eventos.forEach((evento) => window.removeEventListener(evento, marcar));
      clearInterval(timer);
    };
  }, [sessao, sair, renovarAtividade]);

  const expirandoEmBreve =
    segundosParaExpirar !== null && segundosParaExpirar <= SESSION.warnMinutes * 60;

  /* ---------------------------------------------------------------- valor */

  const value = useMemo<AuthContextValue>(
    () => ({
      sessao,
      usuario: sessao?.usuario ?? null,
      permissoes,
      autenticado: Boolean(sessao),
      carregando,
      desafioMfa,
      entrar,
      confirmarMfa,
      cancelarMfa,
      sair,
      pode,
      podeAlguma,
      renovarAtividade,
      segundosParaExpirar,
      expirandoEmBreve,
    }),
    [
      sessao,
      permissoes,
      carregando,
      desafioMfa,
      entrar,
      confirmarMfa,
      cancelarMfa,
      sair,
      pode,
      podeAlguma,
      renovarAtividade,
      segundosParaExpirar,
      expirandoEmBreve,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
