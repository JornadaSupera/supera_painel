import type { StatusTone } from "@/components/shared";
import { SEVERIDADE } from "@/lib/enums";
import type { Severidade, StatusAlerta, StatusConversa } from "@/lib/enums";

/**
 * How the clinical rows read on screen — shared by the queue screens (alerts,
 * chat, agenda) and by the patient record, so the same alert never gets two
 * different colors depending on where it is shown.
 */

export type AlertRowStatus = "open" | "in_progress" | "resolved";
export type ConversationRowStatus = "open" | "resolved";

export const TOM_POR_CODIGO_STATUS: Record<string, StatusTone> = {
  scheduled: "info",
  completed: "success",
  no_show: "warning",
  cancelled: "neutral",
  rescheduled: "neutral",
};

/**
 * What an appointment's situation reads on screen.
 *
 * A past appointment still marked "scheduled" is not scheduled anymore: nobody
 * recorded whether it happened. "Agendado" on a September date read as if it
 * were still to come. The panel neither creates nor changes appointments, so it
 * says what it knows — that it passed with no outcome — and leaves the outcome
 * to whoever records it.
 */
export function situacaoDoCompromisso(
  status: { code: string; label: string } | undefined,
  fim: string,
): { label: string; tom: StatusTone } {
  if (!status) return { label: "—", tom: "neutral" };

  if (status.code === "scheduled" && new Date(fim).getTime() < Date.now()) {
    return { label: "Sem desfecho registrado", tom: "warning" };
  }

  return { label: status.label, tom: TOM_POR_CODIGO_STATUS[status.code] ?? "neutral" };
}

export const STATUS_ALERTA_POR_CODIGO: Record<AlertRowStatus, StatusAlerta> = {
  open: "pendente",
  in_progress: "assumido",
  resolved: "resolvido",
};

export const TOM_POR_STATUS_ALERTA: Record<StatusAlerta, StatusTone> = {
  pendente: "danger",
  assumido: "warning",
  resolvido: "success",
};

export const STATUS_CONVERSA_POR_CODIGO: Record<ConversationRowStatus, StatusConversa> = {
  open: "aberta",
  resolved: "resolvida",
};

export const TOM_POR_STATUS_CONVERSA: Record<StatusConversa, StatusTone> = {
  aberta: "info",
  resolvida: "success",
};

/** Limiar simples grau → severidade — não há mapeamento canônico no banco ainda. */
export function severidadeDoGrau(grau: number): Severidade {
  if (grau >= 5) return SEVERIDADE.CRITICA;
  if (grau === 4) return SEVERIDADE.ALTA;
  if (grau >= 2) return SEVERIDADE.MEDIA;
  return SEVERIDADE.BAIXA;
}
