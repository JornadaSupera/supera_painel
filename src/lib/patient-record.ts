import type { TimelineWindow } from "@/types/patient-record";

/**
 * Rules of the patient record that the form and the Supabase adapter
 * must agree on. Three copies of a limit is how a form accepts what the database
 * refuses.
 */

/** A note is free text, not a formal evolution — long enough for a visit, short enough to stay a note. */
export const SPECIALTY_NOTE_MAX = 4000;

export const TIMELINE_WINDOW_OPTIONS: { value: TimelineWindow; label: string }[] = [
  { value: 30, label: "Últimos 30 dias" },
  { value: 90, label: "Últimos 90 dias" },
  { value: null, label: "Todo o histórico" },
];

/** Start of the window as an ISO instant, or `null` when it reaches as far back as the sources go. */
export function timelineWindowStart(days: number | null, now = Date.now()): string | null {
  return days === null ? null : new Date(now - days * 86_400_000).toISOString();
}

/** The reason to show when the note text cannot be sent, or `null` when it can. */
export function specialtyNoteError(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return "Escreva a anotação antes de salvar.";
  if (trimmed.length > SPECIALTY_NOTE_MAX) {
    return `A anotação tem no máximo ${SPECIALTY_NOTE_MAX} caracteres.`;
  }
  return null;
}
