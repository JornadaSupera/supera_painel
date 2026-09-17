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
 * through a trigger on write and inside the `read_*` functions on read. A log
 * that existed only on the client would be forgeable by anyone who cared — and
 * a forgeable audit log is not an audit.
 *
 * > [!] READS ARE NOT EMITTED HERE, and the absence is the point
 * Reading clinical data goes through a `SECURITY DEFINER` function that records
 * the access before it answers, so the trail is inescapable. Emitting the same
 * event from the client would duplicate it and then diverge from it — and it
 * diverged in a way worth remembering: the emission lived inside `queryFn`, so a
 * screen served from cache produced no event at all, while a refetch triggered
 * by window focus or a reconnection produced one that no one had asked for.
 * Audit semantics that shift with a cache policy are not audit semantics.
 *
 * What stays here is what the database cannot see:
 *
 * | Event | Why the backend misses it |
 * |---|---|
 * | `login` / `logout` | the session lifecycle belongs to the auth service, which does not write to this table |
 * | `export` | turning what is already on screen into a CSV happens in the browser |
 * | `update` / `delete` | reported as intent; the row the trigger writes is the record |
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

export interface RecordedEvent extends AuditEvent {
  id: string;
  origin: OrigemAuditoria;
  created_at: string;
  /** Who acted. `null` before sign-in — only the sign-in event itself. */
  actor_id: string | null;
  actor_name: string;
}

/**
 * In-memory queue.
 *
 * Feeds the audit screen in mock mode, so the panel's own actions can be seen
 * end to end without a backend. It does not persist — and must not: an audit
 * event in `localStorage` is PHI in the browser.
 */
const queue: RecordedEvent[] = [];
const QUEUE_LIMIT = 200;

/**
 * Who the events belong to.
 *
 * A module-level value rather than an argument on every call: the actor is the
 * session, and threading it through forty call sites would make forgetting it
 * the easy mistake. `AuthContext` sets it on sign-in and clears it on sign-out.
 */
let actor: { id: string; name: string } | null = null;

export function setAuditActor(next: { id: string; name: string } | null): void {
  actor = next;
}

/** Records one event. */
export function record(event: AuditEvent): void {
  const recorded: RecordedEvent = {
    ...event,
    id: crypto.randomUUID(),
    origin: event.origin ?? ORIGEM_AUDITORIA.PAINEL,
    created_at: new Date().toISOString(),
    actor_id: actor?.id ?? event.resource_id ?? null,
    actor_name: actor?.name ?? "Sistema",
  };

  queue.push(recorded);
  if (queue.length > QUEUE_LIMIT) queue.shift();
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

  /*
   * There is no `read` shortcut on purpose. See the header: the database
   * records every clinical read inside the function that serves it, and a
   * second emission here would be a duplicate that drifts. Leaving the
   * shortcut available would make the drift easy to reintroduce.
   */

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
