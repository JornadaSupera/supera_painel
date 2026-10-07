import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";

/**
 * The signed-in professional's own numbers between two instants (ISO 8601 UTC).
 * A summary: it changes slowly, so it is not polled.
 */
export function useMeuDesempenho(de: string, ate: string) {
  return useQuery({
    queryKey: queryKeys.clinico.desempenho(de, ate),
    queryFn: async () => (await call(() => clinicoApi.getMeuDesempenho({ de, ate }))).data,
    staleTime: 5 * 60_000,
  });
}
