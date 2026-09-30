import { useQuery } from "@tanstack/react-query";
import { useBlobUrl } from "@/hooks/useBlobUrl";
import { queryKeys } from "@/lib/queryKeys";
import { call, conteudosApi } from "@/services/apiClient";

/**
 * O conteúdo de um anexo de orientação, como URL `blob:` (ver `useBlobUrl`).
 *
 * Serve ao profissional que escreve a orientação e ao administrador que a
 * revisa: os dois leem o mesmo arquivo do mesmo lugar.
 */
export function useContentAttachmentUrl(caminho: string, habilitado = true) {
  const consulta = useQuery({
    queryKey: queryKeys.contents.attachment(caminho),
    enabled: habilitado,
    queryFn: async () => (await call(() => conteudosApi.downloadAttachment({ caminho }))).data,
    staleTime: Infinity,
    retry: false,
  });

  const url = useBlobUrl(consulta.data);

  return { url, isLoading: consulta.isLoading, isError: consulta.isError };
}
