import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { ReforcoDaSessaoDialog } from "@/components/shared/ReforcoDaSessaoDialog";
import { useAuth } from "@/contexts/auth-context";
import { audit } from "@/lib/audit";
import { queryKeys } from "@/lib/queryKeys";
import { authApi, call } from "@/services/apiClient";

/**
 * Exige a sessão com o segundo fator antes de uma ação.
 *
 *   const { exigir, dialogo } = useReforcoDaSessao();
 *   <Button onClick={() => exigir(() => convidar.mutate(dados))} />
 *   {dialogo}
 *
 * `exigir` pergunta o nível da sessão NA HORA — do próprio token, sem ir ao
 * banco. Em `aal2` a ação roda direto. Fora dele, abre o diálogo, e a ação
 * roda quando o código é aceito. Cancelar descarta a ação: nada é executado
 * "para quando a pessoa voltar".
 *
 * > [!] Não decidir por cache.
 * O nível muda no meio da sessão (o código acabou de ser aceito em outra
 * ação). Uma resposta que ficou quente desde o login pediria o código de novo,
 * ou pior, deixaria passar uma sessão que já caiu de nível.
 *
 * Se a pergunta falhar (rede), a ação roda: o banco confere de qualquer jeito
 * e responde `mfa_required`, que cada ação sabe mostrar. Bloquear aqui só
 * transformaria uma falha de leitura em ação impossível.
 */

const RECURSO = "seguranca";

export function useReforcoDaSessao(caminhoSeguranca = "/seguranca"): {
  exigir: (acao: () => void) => Promise<void>;
  dialogo: ReactNode;
} {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const acaoPendente = useRef<(() => void) | null>(null);
  const [aberto, setAberto] = useState(false);
  const [semFator, setSemFator] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const verificar = useMutation({
    mutationFn: async (codigo: string) => (await call(() => authApi.elevarSessao({ codigo }))).data,
  });

  const fechar = useCallback((proximo: boolean) => {
    setAberto(proximo);
    if (!proximo) {
      acaoPendente.current = null;
      setErro(null);
    }
  }, []);

  const exigir = useCallback(async (acao: () => void) => {
    const { data, error } = await authApi.getNivelDaSessao();

    if (error || !data || data.nivel === "aal2") {
      acao();
      return;
    }

    acaoPendente.current = acao;
    setErro(null);
    setSemFator(!data.fator_cadastrado);
    setAberto(true);
  }, []);

  const aoVerificar = (codigo: string) => {
    setErro(null);

    verificar.mutate(codigo, {
      onSuccess: async () => {
        if (user) audit.update(RECURSO, user.id, { operacao: "sessao_reforcada" });

        // O nível da sessão mudou: o que ficou quente sobre ele deixa de valer.
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.assurance() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.auth.secondFactor() }),
        ]);

        const acao = acaoPendente.current;
        acaoPendente.current = null;
        setAberto(false);
        acao?.();
      },
      onError: (falha) => setErro(falha.message),
    });
  };

  const dialogo = (
    <ReforcoDaSessaoDialog
      open={aberto}
      onOpenChange={fechar}
      semFator={semFator}
      verificando={verificar.isPending}
      erro={erro}
      onVerificar={aoVerificar}
      onCadastrar={() => {
        fechar(false);
        navigate(caminhoSeguranca);
      }}
    />
  );

  return { exigir, dialogo };
}
