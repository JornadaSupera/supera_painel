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
