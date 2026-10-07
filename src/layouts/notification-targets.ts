import { useQueryClient, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { Bell, FileText, MessageCircle, TriangleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useMarcarNotificacaoLida } from "@/hooks/useNotificacoes";
import type { Especialidade } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import type { NotificacaoItem } from "@/types/notificacao";

/**
 * Where a notification leads, shared by the bell and by the toast that
 * announces it: both must open the same item, the same way.
 *
 * Each address names the item, not only the screen — `?alerta=`, `?conversa=`,
 * `?execucao=` — and the screen brings it into view. Before going, the reads of
 * that screen are marked stale, so it reads again on arrival instead of showing
 * a minute-old list that may not have the item yet.
 */

export function iconOf(item: NotificacaoItem) {
  if (item.alvo_tabela === "alerts") return TriangleAlert;
  if (item.alvo_tabela === "conversations") return MessageCircle;
  if (item.alvo_tabela === "report_runs") return FileText;
  return Bell;
}

/** Where the click goes. `null` when the panel has no screen for it. */
export function destinationOf(item: NotificacaoItem, especialidade: Especialidade | null): string | null {
  const base = especialidade ? `/clinico/${especialidade}` : null;

  if (item.alvo_tabela === "alerts") {
    if (!base) return null;
    return item.alvo_id ? `${base}/alertas?alerta=${item.alvo_id}` : `${base}/alertas`;
  }

  if (item.alvo_tabela === "conversations") {
    if (!base) return null;
    if (!item.alvo_id) return `${base}/chat`;
    const params = new URLSearchParams({ conversa: item.alvo_id });
    // The colleague who took it resolved it: it is theirs now, and the screen
    // has to say so instead of "not found".
    if (item.codigo === "chat_forward_resolved") params.set("encaminhada", "1");
    return `${base}/chat?${params.toString()}`;
  }

  if (item.alvo_tabela === "report_runs") {
    return item.alvo_id ? `/relatorios?execucao=${item.alvo_id}` : "/relatorios";
  }

  return null;
}

/** The reads the destination screen shows the item from. */
function readsOf(item: NotificacaoItem): QueryKey[] {
  if (item.alvo_tabela === "alerts") return [queryKeys.clinico.alertasAll()];
  if (item.alvo_tabela === "conversations") return [queryKeys.clinico.conversas()];
  if (item.alvo_tabela === "report_runs") return [queryKeys.reports.runs()];
  return [];
}

/** The admin's queues: no notification row, a count — and the screen opens on the most urgent. */
export const PENDING_TARGETS = {
  requests: {
    to: "/configuracoes?aba=lgpd&destaque=aberto",
    reads: [queryKeys.settings.dataSubjectRequests()],
  },
  failedRequests: {
    to: "/configuracoes?aba=lgpd&destaque=falha",
    reads: [queryKeys.settings.dataSubjectRequests()],
  },
  review: {
    to: "/conteudo?destaque=fila",
    reads: [queryKeys.approvals.all],
  },
} as const satisfies Record<string, { to: string; reads: readonly QueryKey[] }>;

export type PendingTarget = keyof typeof PENDING_TARGETS;

export function markStale(queryClient: QueryClient, keys: readonly QueryKey[]): void {
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
}

interface NamedRow {
  paciente_id: string;
  paciente_nome: string;
}

function isNamedRow(value: unknown): value is NamedRow {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as NamedRow).paciente_id === "string" &&
    typeof (value as NamedRow).paciente_nome === "string"
  );
}

/**
 * A patient's name only if a screen already read it — the bell's names, the
 * alert queue, the chat. Never asks: every name asked for is a line on the
 * audit trail, and a toast is not a reason to read a record.
 */
export function cachedPatientName(queryClient: QueryClient, patientId: string): string | null {
  for (const [, nomes] of queryClient.getQueriesData<Record<string, string>>({
    queryKey: queryKeys.notifications.patientNamesAll(),
  })) {
    if (nomes?.[patientId]) return nomes[patientId];
  }

  for (const queryKey of [queryKeys.clinico.alertasAll(), queryKeys.clinico.conversas()]) {
    for (const [, linhas] of queryClient.getQueriesData<unknown>({ queryKey })) {
      if (!Array.isArray(linhas)) continue;
      const linha = linhas.find(
        (item): item is NamedRow => isNamedRow(item) && item.paciente_id === patientId,
      );
      // "Paciente" is the placeholder of a read made without names.
      if (linha && linha.paciente_nome !== "Paciente") return linha.paciente_nome;
    }
  }

  return null;
}

/**
 * Opens a notification: marks it read, makes the destination read again, and
 * goes. Returns `false` when the panel has no screen for it — it is still
 * marked read, since the person saw it.
 */
export function useOpenNotification(especialidade: Especialidade | null) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const marcarLida = useMarcarNotificacaoLida();

  return (item: NotificacaoItem): boolean => {
    if (!item.lida) marcarLida.mutate(item.id);
    const destino = destinationOf(item, especialidade);
    if (!destino) return false;
    markStale(queryClient, readsOf(item));
    navigate(destino);
    return true;
  };
}

/** Opens one of the admin's queues, on its most urgent item. */
export function useOpenPending() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (target: PendingTarget) => {
    markStale(queryClient, PENDING_TARGETS[target].reads);
    navigate(PENDING_TARGETS[target].to);
  };
}
