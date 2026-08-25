import type { AcaoAuditoria, OrigemAuditoria } from "./enums";
import { ACAO_AUDITORIA, ORIGEM_AUDITORIA } from "./enums";

/**
 * AUDIT TRAIL
 * =============================================================================
 * Single emitter for the events that need a trace: who accessed what, when,
 * from where and which action they performed.
 *
 * Every sensitive action goes through here. No screen builds an event by hand,
 * so the shape is the same across the whole panel and the audit table can read
 * all of it.
 *
 * > [!] The definitive record belongs to the backend.
 * The front-end **reports** the intent; what writes it immutably is Postgres,
 * preferably through a trigger. A log that existed only on the client would be
 * forgeable by anyone who cared — and a forgeable audit log is not an audit.
 */

export interface AuditEvent {
  action: AcaoAuditoria;
  /** What was touched: "pacientes", "usuarios", "relatorios/nps". */
  resource: string;
  /** Id of the specific record, when there is one. */
  resource_id?: string;
  /** Filled in when the action involves a patient's data. */
  patient_id?: string;
  origin?: OrigemAuditoria;
  /** Justification typed by the user — comes from the ConfirmDialog. */
  reason?: string;
  /** Extra context. Never put PHI here. */
  details?: Record<string, unknown>;
}

interface RecordedEvent extends AuditEvent {
  origin: OrigemAuditoria;
  created_at: string;
}

/**
 * In-memory queue.
 *
 * While the backend does not exist, events stay here to feed the audit screen
 * during development. It does not persist — and must not: an audit event in
 * `localStorage` is PHI in the browser.
 */
const queue: RecordedEvent[] = [];
const QUEUE_LIMIT = 200;

/** Records one event. */
export function record(event: AuditEvent): void {
  const recorded: RecordedEvent = {
    ...event,
    origin: event.origin ?? ORIGEM_AUDITORIA.PAINEL,
    created_at: new Date().toISOString(),
  };

  queue.push(recorded);
  if (queue.length > QUEUE_LIMIT) queue.shift();

  // Once the backend exists: enqueue for the Edge Function / Postgres trigger.
}

/** Events from the current session, newest first. */
export function sessionEvents(): readonly RecordedEvent[] {
  return [...queue].reverse();
}

/* -------------------------------------------------------------------------
   SHORTCUTS
   They cover the cases that repeat across the panel, so nobody has to
   remember which `action` to use.
   ------------------------------------------------------------------------- */

export const audit = {
  login: (user_id: string) =>
    record({ action: ACAO_AUDITORIA.LOGIN, resource: "auth", resource_id: user_id }),

  logout: (user_id: string, reason?: string) =>
    record({ action: ACAO_AUDITORIA.LOGOUT, resource: "auth", resource_id: user_id, reason }),

  read: (resource: string, resource_id?: string, patient_id?: string) =>
    record({ action: ACAO_AUDITORIA.LEITURA, resource, resource_id, patient_id }),

  update: (resource: string, resource_id: string, details?: Record<string, unknown>) =>
    record({ action: ACAO_AUDITORIA.EDICAO, resource, resource_id, details }),

  delete: (resource: string, resource_id: string, reason: string) =>
    record({ action: ACAO_AUDITORIA.EXCLUSAO, resource, resource_id, reason }),

  export: (resource: string, details?: Record<string, unknown>) =>
    record({ action: ACAO_AUDITORIA.EXPORTACAO, resource, details }),

  /**
   * Access to confidential data — includes revealing a full CPF, phone or
   * e-mail. It is why masking is the default: every reveal leaves a trace.
   */
  confidential: (resource: string, resource_id?: string, patient_id?: string) =>
    record({ action: ACAO_AUDITORIA.SIGILOSO, resource, resource_id, patient_id }),
};
