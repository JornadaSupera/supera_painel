import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";

/**
 * A carteira de quem está logado nos últimos `dias`. Ver `getCarteira`.
 *
 * A leitura junta a agenda, a lista de pacientes e a fila de alertas, e cada uma
 * delas é auditada pelo banco; por isso o resultado fica quente pelo tempo padrão
 * em vez de ser refeito a cada troca de aba.
 */
export function useCarteira(dias: number) {
  return useQuery({
    queryKey: queryKeys.clinico.carteira(dias),
    queryFn: async () => (await call(() => clinicoApi.getCarteira({ dias }))).data,
  });
}
