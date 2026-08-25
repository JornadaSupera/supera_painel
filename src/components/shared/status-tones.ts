import type { StatusTone } from "./StatusBadge";

/**
 * Mapas de status → tom do badge.
 *
 * Ficam centralizados, e não espalhados nas telas, para que "Ativo" seja verde
 * no mesmo tom em Pacientes, Usuários e Auditoria.
 *
 * Arquivo separado do componente por exigência do Fast Refresh: um módulo que
 * exporta componentes não pode exportar também constantes.
 */

export const TONE_STATUS_USUARIO: Record<string, StatusTone> = {
  ativo: "success",
  pausado: "warning",
  inativo: "neutral",
};

export const TONE_STATUS_PACIENTE: Record<string, StatusTone> = {
  ativo: "success",
  inativo: "neutral",
};

export const TONE_FASE: Record<string, StatusTone> = {
  ativo: "success",
  seguimento: "info",
  manutencao: "primary",
  remissao: "info",
  finalizacao: "neutral",
};

export const TONE_RISCO: Record<string, StatusTone> = {
  baixo: "success",
  medio: "warning",
  alto: "danger",
};

export const TONE_SEVERIDADE: Record<string, StatusTone> = {
  baixa: "neutral",
  media: "info",
  alta: "warning",
  critica: "danger",
};

export const TONE_STATUS_CONTEUDO: Record<string, StatusTone> = {
  rascunho: "neutral",
  em_revisao: "info",
  aprovado: "success",
  publicado: "success",
  devolvido: "warning",
  rejeitado: "danger",
  despublicado: "neutral",
};

export const TONE_ACAO_AUDITORIA: Record<string, StatusTone> = {
  leitura: "info",
  edicao: "warning",
  exclusao: "danger",
  sigiloso: "primary",
  exportacao: "neutral",
  login: "neutral",
  logout: "neutral",
};
