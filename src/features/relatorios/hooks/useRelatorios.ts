import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/contexts/auth-context";
import { audit } from "@/lib/audit";
import { downloadFile, nameWithDate, toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/format";
import { exportPdf, timestamp } from "@/lib/pdf";
import { queryKeys } from "@/lib/queryKeys";
import { call, relatoriosApi } from "@/services/apiClient";
import type { AgendamentoRelatorioEntrada } from "@/types/relatorio";

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
export function useRelatorio(slug: string | undefined, dias: number, especialidade?: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.run(slug ?? "", { dias, especialidade: especialidade ?? null }),
    enabled: Boolean(slug),
    queryFn: async () =>
      (await call(() => relatoriosApi.run({ slug: slug as string, dias, especialidade }))).data,
  });
}

export function useExportarRelatorio() {
  return useMutation({
    mutationFn: async ({
      slug,
      dias,
      especialidade,
    }: {
      slug: string;
      dias: number;
      especialidade?: string | null;
    }) => {
      const { data, count } = await call(() =>
        relatoriosApi.export({ slug, dias, especialidade }),
      );

      audit.export(RECURSO, { relatorio: slug, dias, especialidade, linhas: count });
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

/**
 * Exporta o resultado aberto como PDF: uma captura da própria tela, em retrato,
 * em quantas páginas couber.
 *
 * O rodapé diz QUEM exportou e QUANDO — um PDF de dado clínico que circula sem
 * procedência é um problema de rastreabilidade. A trilha é gravada depois de o
 * arquivo existir: até lá nada saiu do painel, e um PDF que falha no meio não
 * deve constar como exportado.
 */
export function useExportarRelatorioPdf() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      slug,
      element,
      linhas,
      filtros,
    }: {
      slug: string;
      element: HTMLElement;
      linhas: number;
      filtros: Record<string, string | number | null>;
    }) => {
      const rodape = user
        ? `Jornada Supera · exportado por ${user.nome} em ${formatDateTime(new Date().toISOString())}`
        : undefined;

      await exportPdf({
        element,
        name: `relatorio-${slug}_${timestamp()}`,
        footer: rodape,
        orientation: "portrait",
        paginate: true,
      });

      audit.export(RECURSO, { relatorio: slug, formato: "pdf", linhas, ...filtros });
      await call(() => relatoriosApi.registrarExportacao({ slug, linhas, formato: "pdf" }));
    },
    onSuccess: () =>
      toast.success("Relatório exportado em PDF", {
        description: "A exportação foi registrada na auditoria.",
      }),
    onError: () =>
      toast.error("Não foi possível gerar o PDF", {
        description: "Tente novamente. Se persistir, avise o suporte.",
      }),
  });
}

/* -------------------------------------------------------------------------
   AGENDAMENTO — `report_schedules` + `report_runs`, desde 25/09/2026
   ------------------------------------------------------------------------- */

export function useAgendamentos() {
  return useQuery({
    queryKey: queryKeys.reports.schedules(),
    queryFn: async () => (await call(() => relatoriosApi.listAgendamentos())).data,
  });
}

export function useExecucoes() {
  return useQuery({
    queryKey: queryKeys.reports.runs(),
    queryFn: async () => (await call(() => relatoriosApi.listExecucoes())).data,
  });
}

/**
 * The generation a "report ready" notification points to: which report, and
 * which period. A plain read of `report_runs`, which only the administration
 * sees. It does not change once written.
 */
export function useExecucao(id: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.execution(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => (await call(() => relatoriosApi.getExecucao({ id: id as string }))).data,
    staleTime: Infinity,
  });
}

export function useCriarAgendamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AgendamentoRelatorioEntrada) => {
      const { data } = await call(() => relatoriosApi.criarAgendamento(params));
      audit.update(RECURSO, data?.id ?? params.slug, { operacao: "agendamento" });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.schedules() });
      toast.success("Relatório agendado");
    },
    onError: (erro) => toast.error("Não foi possível agendar", { description: erro.message }),
  });
}

export function useAtualizarAgendamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AgendamentoRelatorioEntrada & { id: string }) => {
      const { data } = await call(() => relatoriosApi.atualizarAgendamento(params));
      audit.update(RECURSO, params.id, { operacao: "agendamento" });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.schedules() });
      toast.success("Agendamento atualizado");
    },
    onError: (erro) => toast.error("Não foi possível atualizar o agendamento", { description: erro.message }),
  });
}

export function useSetAgendamentoAtivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; ativo: boolean }) => {
      const { data } = await call(() => relatoriosApi.setAgendamentoAtivo(params));
      audit.update(RECURSO, params.id, { operacao: "agendamento", ativo: params.ativo });
      return data;
    },
    onSuccess: async (agendamento) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reports.schedules() });
      toast.success(agendamento?.ativo ? "Agendamento retomado" : "Agendamento pausado");
    },
    onError: (erro) => toast.error("Não foi possível mudar o agendamento", { description: erro.message }),
  });
}
