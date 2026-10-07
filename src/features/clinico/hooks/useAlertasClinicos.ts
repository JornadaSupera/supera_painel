import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useMarcarLidasDoAlvo } from "@/hooks/useNotificacoes";
import { audit } from "@/lib/audit";
import type { CondutaAlerta, StatusAlerta } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";

/** A fila de alertas — toda a equipe vê a mesma lista. Ver `clinico.listAlertas`. */
export function useAlertasClinicos(status?: StatusAlerta, opcoes: { semNomes?: boolean } = {}) {
  const { semNomes = false } = opcoes;

  return useQuery({
    // A leitura sem nomes é outra consulta: guardá-la na chave da leitura com
    // nomes faria uma tela que precisa do nome receber a que não tem.
    queryKey: [...queryKeys.clinico.alertas(status), ...(semNomes ? ["sem-nomes"] : [])],
    queryFn: async () =>
      (await call(() => clinicoApi.listAlertas({ ...(status ? { status } : {}), ...(semNomes ? { semNomes } : {}) })))
        .data,
    // A fila muda por ação de qualquer pessoa da equipe, não só a sua.
    refetchInterval: 60_000,
  });
}

/**
 * What an action on an alert changes: the queue and everything counted from it
 * in the clinical panel (the day's panel, the record's timeline, the
 * professional's own numbers), the executive dashboard's active alerts, and the
 * bell. The bell is refreshed by the mutation cache; the notifications that
 * pointed to this alert are marked read here, because acting on it is having
 * seen it.
 */
function useInvalidarAlertas() {
  const queryClient = useQueryClient();
  const marcarLidas = useMarcarLidasDoAlvo();

  return (id: string) => {
    marcarLidas.mutate({ tabela: "alerts", id });
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.clinico.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
    ]);
  };
}

/**
 * Assumir exige a permissão `alerts.triage` no backend — sem ela, o erro que
 * volta é "Você não tem permissão para isso", e é isso que aparece no toast.
 * Não há como saber de antemão sem perguntar ao banco.
 */
export function useAssumirAlerta() {
  const invalidar = useInvalidarAlertas();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.assumirAlerta({ id }))).data,
    onSuccess: async (_data, id) => {
      await invalidar(id);
      toast.success("Alerta assumido");
    },
    onError: (erro) => toast.error("Não foi possível assumir o alerta", { description: erro.message }),
  });
}

export function useResolverAlerta() {
  const invalidar = useInvalidarAlertas();

  return useMutation({
    mutationFn: async (params: { id: string; conduta: CondutaAlerta; notas?: string }) =>
      (await call(() => clinicoApi.resolverAlerta(params))).data,
    onSuccess: async (_data, params) => {
      await invalidar(params.id);
      toast.success("Alerta resolvido");
    },
    onError: (erro) => toast.error("Não foi possível resolver o alerta", { description: erro.message }),
  });
}

/**
 * Designar exige a mesma permissão de triagem, e o designado recebe uma
 * notificação. A recusa do banco chega com a frase pronta (permissão, alerta que
 * mudou de estado, profissional desativado).
 */
export function useDesignarAlerta() {
  const invalidar = useInvalidarAlertas();

  return useMutation({
    mutationFn: async (params: { id: string; profissionalId: string; nome: string }) =>
      (await call(() => clinicoApi.designarAlerta({ id: params.id, profissionalId: params.profissionalId }))).data,
    onSuccess: (_data, params) => {
      audit.update("alerts", params.id, { operation: "assign" });
      void invalidar(params.id);
      toast.success(`Alerta designado a ${params.nome}`);
    },
    onError: (erro) => toast.error("Não foi possível designar o alerta", { description: erro.message }),
  });
}
