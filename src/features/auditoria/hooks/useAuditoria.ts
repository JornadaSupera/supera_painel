import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { audit } from "@/lib/audit";
import { downloadFile, nameWithDate, toCsv } from "@/lib/csv";
import { queryKeys } from "@/lib/queryKeys";
import { auditoriaApi, call } from "@/services/apiClient";
import type { ListParams } from "@/services/contracts";
import { janelaComoRange, useAuditoriaStore } from "@/stores/auditoria";

/**
 * Leitura da trilha de auditoria.
 *
 * > [!] Consultar a trilha também deixa rastro.
 * Quem audita é auditado — é o que impede que a tela de auditoria seja o ponto
 * cego do sistema. Por isso a exportação registra o próprio evento antes de
 * baixar o arquivo.
 *
 * Nada aqui escreve na trilha do backend: `audit_log` é append-only e as linhas
 * nascem de gatilho no banco. O que `lib/audit.ts` registra é o evento do
 * cliente, que a Fase 15 passa a enviar junto.
 */

const RECURSO = "auditoria";

function useParametros(): ListParams {
  const busca = useAuditoriaStore((estado) => estado.busca);
  const filtros = useAuditoriaStore((estado) => estado.filtros);
  const janelaDias = useAuditoriaStore((estado) => estado.janelaDias);
  const sort = useAuditoriaStore((estado) => estado.sort);
  const page = useAuditoriaStore((estado) => estado.page);
  const pageSize = useAuditoriaStore((estado) => estado.pageSize);

  const buscaAtrasada = useDebouncedValue(busca);

  return {
    page,
    pageSize,
    sort,
    search: buscaAtrasada,
    filters: filtros,
    range: janelaComoRange(janelaDias),
  };
}

export function useTrilha() {
  const params = useParametros();

  const query = useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => call(() => auditoriaApi.list(params)),
    placeholderData: (anterior) => anterior,
  });

  return {
    ...query,
    registros: query.data?.data ?? [],
    total: query.data?.count ?? 0,
    params,
  };
}

/** Os contadores do topo. A janela é a mesma que a lista está usando. */
export function useResumoAuditoria() {
  const janelaDias = useAuditoriaStore((estado) => estado.janelaDias);
  const janelaHoras = Number(janelaDias || 0) * 24 || 24;

  return useQuery({
    queryKey: queryKeys.audit.summary({ janelaHoras }),
    queryFn: async () => (await call(() => auditoriaApi.getSummary({ janelaHoras }))).data,
  });
}

/* -------------------------------------------------------------------------
   EXPORTAÇÃO — o relatório do DPO
   ------------------------------------------------------------------------- */

export type FormatoExportacao = "csv" | "json";

/**
 * Baixa o recorte atual em CSV ou JSON.
 *
 * A LGPD pede que o titular possa receber o registro dos acessos aos dados
 * dele, e o encarregado precisa de um formato que abra em planilha e de outro
 * que se leia por máquina — daí os dois.
 */
export function useExportarTrilha() {
  const params = useParametros();

  return useMutation({
    mutationFn: async (formato: FormatoExportacao) => {
      const { data, count } = await call(() => auditoriaApi.export(params));

      audit.export(RECURSO, { formato, linhas: count });

      if (formato === "json") {
        downloadFile(
          JSON.stringify(data, null, 2),
          nameWithDate("auditoria", "json"),
          "application/json;charset=utf-8",
        );
      } else {
        downloadFile(toCsv(data), nameWithDate("auditoria", "csv"));
      }

      return { formato, linhas: count };
    },
    onSuccess: ({ formato, linhas }) =>
      toast.success(`Trilha exportada em ${formato.toUpperCase()}`, {
        description: `${linhas} registros do recorte atual. A exportação foi registrada na auditoria.`,
      }),
    onError: (erro) => toast.error("Não foi possível exportar", { description: erro.message }),
  });
}
