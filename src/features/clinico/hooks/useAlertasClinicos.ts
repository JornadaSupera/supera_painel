import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CondutaAlerta, StatusAlerta } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";

/** A fila de alertas — toda a equipe vê a mesma lista. Ver `clinico.listAlertas`. */
export function useAlertasClinicos(status?: StatusAlerta) {
  return useQuery({
    queryKey: queryKeys.clinico.alertas(status),
    queryFn: async () => (await call(() => clinicoApi.listAlertas(status ? { status } : undefined))).data,
    // A fila muda por ação de qualquer pessoa da equipe, não só a sua.
    refetchInterval: 60_000,
  });
}

function useInvalidarAlertas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.clinico.all });
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
    onSuccess: async () => {
      await invalidar();
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
    onSuccess: async () => {
      await invalidar();
      toast.success("Alerta resolvido");
    },
    onError: (erro) => toast.error("Não foi possível resolver o alerta", { description: erro.message }),
  });
}
