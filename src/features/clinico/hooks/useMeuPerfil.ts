import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";

/** O cadastro de quem está logado. Muda raramente, então não é relido a cada troca de aba. */
export function useMeuPerfil() {
  return useQuery({
    queryKey: queryKeys.clinico.perfil(),
    queryFn: async () => (await call(() => clinicoApi.getMeuPerfil())).data,
    staleTime: 5 * 60_000,
  });
}
