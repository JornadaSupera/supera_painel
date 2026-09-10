import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { audit } from "@/lib/audit";
import { downloadFile, nameWithDate, toCsv } from "@/lib/csv";
import { queryKeys } from "@/lib/queryKeys";
import { call, relatoriosApi } from "@/services/apiClient";

/**
 * Catálogo, execução e exportação dos relatórios.
 *
 * Rodar um relatório é leitura agregada de base clínica, e exportar tira o
 * número de dentro do painel. As duas coisas registram auditoria: a primeira
 * porque alguém consultou, a segunda porque alguém levou embora.
 */

const RECURSO = "relatorios";

export function useDefinicoes() {
  return useQuery({
    queryKey: queryKeys.reports.definitions(),
    queryFn: async () => (await call(() => relatoriosApi.listDefinitions())).data,
  });
}

/** Roda um relatório. Só busca quando há um slug escolhido. */
export function useRelatorio(slug: string | undefined, dias: number) {
  return useQuery({
    queryKey: queryKeys.reports.run(slug ?? "", { dias }),
    enabled: Boolean(slug),
    queryFn: async () => {
      const resultado = await call(() =>
        relatoriosApi.run({ slug: slug as string, dias }),
      );
      audit.read(`${RECURSO}/${slug}`, undefined);
      return resultado.data;
    },
  });
}

export function useExportarRelatorio() {
  return useMutation({
    mutationFn: async ({ slug, dias }: { slug: string; dias: number }) => {
      const { data, count } = await call(() => relatoriosApi.export({ slug, dias }));

      audit.export(RECURSO, { relatorio: slug, dias, linhas: count });
      downloadFile(toCsv(data), nameWithDate(`relatorio-${slug}`, "csv"));

      return count;
    },
    onSuccess: (linhas) =>
      toast.success("Relatório exportado", {
        description: `${linhas} linhas em CSV. A exportação foi registrada na auditoria.`,
      }),
    onError: (erro) => toast.error("Não foi possível exportar", { description: erro.message }),
  });
}
