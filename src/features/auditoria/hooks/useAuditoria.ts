import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toListQuery } from "@/hooks/listQuery";
import { useListParams } from "@/hooks/useListParams";
import { audit } from "@/lib/audit";
import { downloadFile, nameWithDate, toCsv } from "@/lib/csv";
import { queryKeys } from "@/lib/queryKeys";
import { auditoriaApi, call } from "@/services/apiClient";
import type { ListParams } from "@/services/contracts";
import { janelaComoRange, useAuditoriaStore } from "@/stores/auditoria";

/**
 * Leitura da trilha de auditoria.
 *
 * A exportação da própria trilha é declarada ao banco (`log_data_export`), como
 * a de relatórios e a da lista de pacientes: a trilha distingue quem consultou de
 * quem levou o arquivo embora. Como isso cria um registro novo, a lista e os
 * contadores são relidos depois de exportar.
 */

const RECURSO = "auditoria";

function useParametros(): ListParams {
  const recorte = useListParams(useAuditoriaStore);
  const janelaDias = useAuditoriaStore((estado) => estado.janelaDias);

  return { ...recorte, range: janelaComoRange(janelaDias) };
}

export function useTrilha() {
  const params = useParametros();

  const query = useQuery({
    queryKey: queryKeys.audit.list(params),
    queryFn: () => call(() => auditoriaApi.list(params)),
    placeholderData: (anterior) => anterior,
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, registros: items, params };
}

/**
 * Opções dos seletores de usuário e de paciente.
 *
 * Depende só da janela, de propósito: se as opções seguissem os filtros
 * aplicados, escolher um usuário faria os outros sumirem da lista e não haveria
 * como trocar de escolha sem limpar tudo.
 */
export function useFacetasAuditoria() {
  const janelaDias = useAuditoriaStore((estado) => estado.janelaDias);
  const range = janelaComoRange(janelaDias);

  return useQuery({
    queryKey: queryKeys.audit.facets(range),
    queryFn: async () => (await call(() => auditoriaApi.getFacets({ range }))).data,
    // A janela muda pouco e a leitura é a mesma que a lista já faz. Manter o
    // resultado quente evita refazê-la a cada troca de filtro ou de página.
    staleTime: 60_000,
  });
}

/** Um registro da trilha, aberto. Só busca quando há um id selecionado. */
export function useRegistroAuditoria(id: string | null) {
  return useQuery({
    queryKey: queryKeys.audit.detail(id ?? ""),
    queryFn: async () => {
      // `enabled` já impede a chamada sem id; a guarda existe para o tipo, e
      // dispensa a asserção que só serviria para calar o compilador.
      if (!id) return null;
      return (await call(() => auditoriaApi.getById({ id }))).data;
    },
    enabled: Boolean(id),
  });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formato: FormatoExportacao) => {
      const { data, count } = await call(() => auditoriaApi.export(params));

      // O número que interessa é o que ENTROU no arquivo, não o tamanho do
      // recorte: o backend devolve a página até o teto dele, e o recorte pode
      // ser maior. Anunciar o total e entregar menos faz quem conferir a
      // planilha concluir que faltou dado no banco.
      const linhas = data.length;

      audit.export(RECURSO, { formato, linhas });

      if (formato === "json") {
        downloadFile(
          JSON.stringify(data, null, 2),
          nameWithDate("auditoria", "json"),
          "application/json;charset=utf-8",
        );
      } else {
        downloadFile(toCsv(data), nameWithDate("auditoria", "csv"));
      }

      return { formato, linhas, restantes: Math.max(0, count - linhas) };
    },
    onSuccess: ({ formato, linhas, restantes }) => {
      // A exportação acabou de gravar uma linha na trilha: sem reler, a lista e o
      // cartão de exportação ficam um registro atrás do que o banco já tem.
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit.lists() });
      void queryClient.invalidateQueries({ queryKey: [...queryKeys.audit.all, "summary"] });

      toast.success(`Trilha exportada em ${formato.toUpperCase()}`, {
        description: restantes
          ? `${linhas} registros no arquivo — os mais recentes do recorte. Outros ${restantes} ficaram de fora: estreite o período para levá-los.`
          : `${linhas} registros do recorte atual.`,
      });
    },
    onError: (erro) => toast.error("Não foi possível exportar", { description: erro.message }),
  });
}
