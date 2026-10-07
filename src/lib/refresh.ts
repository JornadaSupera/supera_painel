/**
 * How often a screen rereads on its own while it is open — not live, but never
 * stale for long. TanStack Query pauses it while the tab is in the background,
 * and a screen that is not mounted does not read at all.
 *
 * Two speeds, because some reads write a line to the audit trail each time
 * (`read_patient_list`, `read_patient`): those refresh every two minutes, the
 * free ones every minute.
 */
export const REFRESH_MS = {
  /** Plain table reads: users, data-subject requests, notifications. */
  livre: 60_000,
  /** Audited or heavy reads: patients, the record, the content library. */
  auditada: 120_000,
} as const;
