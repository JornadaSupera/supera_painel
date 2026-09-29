import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { audit } from "@/lib/audit";
import { MFA_REQUIRED } from "@/lib/env";
import { queryKeys } from "@/lib/queryKeys";
import { authApi, call } from "@/services/apiClient";

/**
 * O autenticador da PRÓPRIA conta.
 *
 * Cadastrar e remover são atos sobre o acesso de quem os faz, então cada um
 * deixa rastro na trilha: numa apuração, "quando esta conta passou a exigir
 * código" e "quando deixou de exigir" são as duas perguntas.
 */

const RECURSO = "seguranca";

export function useSegundoFator() {
  return useQuery({
    queryKey: queryKeys.auth.secondFactor(),
    queryFn: async () => (await call(() => authApi.getSegundoFator())).data,
  });
}

/**
 * Cada tentativa pede um QR novo: quem já tinha um aberto ficaria com um
 * fator pendente que o servidor descarta na tentativa seguinte, então o
 * resultado não é guardado em cache.
 */
export function useIniciarCadastro() {
  return useMutation({
    mutationFn: async () => (await call(() => authApi.iniciarCadastroTotp())).data,
    onError: (erro) =>
      toast.error("Não foi possível começar o cadastro", { description: erro.message }),
  });
}

/**
 * O erro do código volta ao chamador em vez de virar aviso: quem digitou errado
 * está olhando para o campo, e é ali que a mensagem precisa aparecer.
 */
export function useConfirmarCadastro() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { fator_id: string; codigo: string }) =>
      (await call(() => authApi.confirmarCadastroTotp(params))).data,
    onSuccess: async () => {
      if (user) audit.update(RECURSO, user.id, { operacao: "segundo_fator_cadastrado" });

      /*
       * Tudo, e não só o autenticador: a sessão acabou de subir de nível. Quem
       * chegou aqui porque o painel estava zerado por falta de segundo fator
       * precisa que cada tela releia agora, e a garantia da sessão — que fica
       * quente por sessão — precisa ser refeita para a moldura abrir.
       */
      await queryClient.invalidateQueries();

      toast.success("Autenticador ativado", {
        description: MFA_REQUIRED
          ? "A partir do próximo acesso, o login pede o código do aplicativo."
          : "O aplicativo ficou vinculado à conta.",
      });
    },
  });
}

export function useCancelarCadastro() {
  return useMutation({
    mutationFn: async (params: { fator_id: string }) =>
      (await call(() => authApi.cancelarCadastroTotp(params))).data,
  });
}

export function useRemoverSegundoFator() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (params: { fator_id: string; motivo: string }) =>
      (await call(() => authApi.removerSegundoFator({ fator_id: params.fator_id }))).data,
    onSuccess: async (_dados, params) => {
      if (user) {
        audit.update(RECURSO, user.id, {
          operacao: "segundo_fator_removido",
          motivo: params.motivo,
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.secondFactor() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.assurance() }),
      ]);

      toast.success(
        "Autenticador removido",
        MFA_REQUIRED ? { description: "O próximo acesso volta a pedir só a senha." } : undefined,
      );
    },
    onError: (erro) =>
      toast.error("Não foi possível remover o autenticador", { description: erro.message }),
  });
}
