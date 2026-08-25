import type { AcaoAuditoria, OrigemAuditoria } from "./enums";
import { ACAO_AUDITORIA, ORIGEM_AUDITORIA } from "./enums";

/**
 * TRILHA DE AUDITORIA
 * =============================================================================
 * Emissor único dos eventos que precisam de rastro: quem acessou, quando, de
 * onde e qual ação realizou (PDF §6 — Auditoria Detalhada).
 *
 * Toda ação sensível chama daqui. Nenhuma tela monta evento na mão — assim o
 * formato é o mesmo em todo o painel e a tabela da Fase 10 sabe ler tudo.
 *
 * > [!] O registro definitivo é do backend.
 * O front-end **relata** a intenção; quem grava de forma imutável é o Postgres
 * (Fase 15), preferencialmente por trigger. Um log que só existisse no cliente
 * seria falsificável por quem quisesse — e um log de auditoria falsificável não
 * é auditoria.
 */

export interface EventoAuditoria {
  acao: AcaoAuditoria;
  /** O que foi tocado: "pacientes", "usuarios", "relatorios/nps". */
  recurso: string;
  /** Id do registro específico, quando houver. */
  recurso_id?: string;
  /** Preenchido quando a ação envolve dados de um paciente. */
  paciente_id?: string;
  origem?: OrigemAuditoria;
  /** Justificativa informada pelo usuário — vem do ConfirmDialog. */
  motivo?: string;
  /** Contexto adicional. Nunca colocar PHI aqui. */
  detalhes?: Record<string, unknown>;
}

interface EventoRegistrado extends EventoAuditoria {
  origem: OrigemAuditoria;
  criado_em: string;
}

/**
 * Fila em memória.
 *
 * Enquanto o backend não existe, os eventos ficam aqui para alimentar a tela
 * de Auditoria (Fase 10) durante o desenvolvimento. Não persiste — e não deve:
 * evento de auditoria em `localStorage` é PHI no navegador.
 */
const fila: EventoRegistrado[] = [];
const LIMITE_FILA = 200;

/** Registra um evento. */
export function registrar(evento: EventoAuditoria): void {
  const registrado: EventoRegistrado = {
    ...evento,
    origem: evento.origem ?? ORIGEM_AUDITORIA.PAINEL,
    criado_em: new Date().toISOString(),
  };

  fila.push(registrado);
  if (fila.length > LIMITE_FILA) fila.shift();

  // Fase 15: enfileirar para a Edge Function / trigger no Postgres.
}

/** Eventos da sessão atual, do mais recente para o mais antigo. */
export function eventosDaSessao(): readonly EventoRegistrado[] {
  return [...fila].reverse();
}

/* -------------------------------------------------------------------------
   ATALHOS
   Cobrem os casos que se repetem no painel, para que ninguém precise lembrar
   qual `acao` usar.
   ------------------------------------------------------------------------- */

export const auditar = {
  login: (usuario_id: string) =>
    registrar({ acao: ACAO_AUDITORIA.LOGIN, recurso: "auth", recurso_id: usuario_id }),

  logout: (usuario_id: string, motivo?: string) =>
    registrar({ acao: ACAO_AUDITORIA.LOGOUT, recurso: "auth", recurso_id: usuario_id, motivo }),

  leitura: (recurso: string, recurso_id?: string, paciente_id?: string) =>
    registrar({ acao: ACAO_AUDITORIA.LEITURA, recurso, recurso_id, paciente_id }),

  edicao: (recurso: string, recurso_id: string, detalhes?: Record<string, unknown>) =>
    registrar({ acao: ACAO_AUDITORIA.EDICAO, recurso, recurso_id, detalhes }),

  exclusao: (recurso: string, recurso_id: string, motivo: string) =>
    registrar({ acao: ACAO_AUDITORIA.EXCLUSAO, recurso, recurso_id, motivo }),

  exportacao: (recurso: string, detalhes?: Record<string, unknown>) =>
    registrar({ acao: ACAO_AUDITORIA.EXPORTACAO, recurso, detalhes }),

  /**
   * Acesso a dado sigiloso — inclui revelar CPF, telefone ou e-mail completos.
   * É a razão pela qual o mascaramento é o padrão: cada revelação deixa rastro.
   */
  sigiloso: (recurso: string, recurso_id?: string, paciente_id?: string) =>
    registrar({ acao: ACAO_AUDITORIA.SIGILOSO, recurso, recurso_id, paciente_id }),
};
