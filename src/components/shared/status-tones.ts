import type { StatusTone } from "./StatusBadge";

/**
 * Status → badge tone maps.
 *
 * They live in one place, rather than spread across screens, so that "Ativo" is
 * the same green in Patients, Users and Audit.
 *
 * Kept in a file of its own because of Fast Refresh: a module that exports
 * components cannot also export constants.
 */

export const TONE_USER_STATUS: Record<string, StatusTone> = {
  ativo: "success",
  pausado: "warning",
  inativo: "neutral",
};

export const TONE_PATIENT_STATUS: Record<string, StatusTone> = {
  ativo: "success",
  inativo: "neutral",
};

export const TONE_PHASE: Record<string, StatusTone> = {
  ativo: "success",
  seguimento: "info",
  manutencao: "primary",
  remissao: "info",
  finalizacao: "neutral",
};

export const TONE_RISK: Record<string, StatusTone> = {
  baixo: "success",
  medio: "warning",
  alto: "danger",
};

export const TONE_SEVERITY: Record<string, StatusTone> = {
  baixa: "neutral",
  media: "info",
  alta: "warning",
  critica: "danger",
};

export const TONE_CONTENT_STATUS: Record<string, StatusTone> = {
  rascunho: "neutral",
  em_revisao: "info",
  aprovado: "success",
  publicado: "success",
  devolvido: "warning",
  rejeitado: "danger",
  despublicado: "neutral",
};

export const TONE_AUDIT_ACTION: Record<string, StatusTone> = {
  leitura: "info",
  edicao: "warning",
  exclusao: "danger",
  sigiloso: "primary",
  exportacao: "neutral",
  login: "neutral",
  logout: "neutral",
};
