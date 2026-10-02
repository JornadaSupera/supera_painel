import type { Especialidade } from "@/lib/enums";

/**
 * The professional's own calendar: what they blocked, when the clinic works, and
 * the kinds of appointment they can filter by.
 */

/** A stretch the professional marked as unavailable. Only its owner ever sees it. */
export interface PersonalBlock {
  id: string;
  label: string | null;
  /** ISO 8601 UTC. */
  starts_at: string;
  ends_at: string;
}

export interface PersonalBlockInput {
  label: string | null;
  starts_at: string;
  ends_at: string;
}

/**
 * What saving a block tells back: its id, and the appointments the professional
 * already had in that stretch.
 *
 * The block is accepted even with conflicts — nothing is cancelled for the
 * person — so the conflicts are a warning to show, not an error. They carry only
 * times: no patient, no title, no id. The screen already has the agenda loaded
 * and marks them by time.
 */
export interface SavedBlock {
  id: string;
  conflicts: { starts_at: string; ends_at: string }[];
}

/** One opening interval of the clinic. A day can have more than one. */
export interface BusinessHour {
  /** 0 = Sunday. */
  weekday: number;
  /** `"HH:MM"`. */
  opens_at: string;
  closes_at: string;
}

/**
 * A stretch when someone on the team cannot take appointments. Times only: the
 * label stays with its owner, and so does the block's id.
 */
export interface BusyInterval {
  professional_id: string;
  starts_at: string;
  ends_at: string;
}

/**
 * Whether the signed-in professional manages the schedule, and who they are as a
 * professional.
 *
 * A professional cannot read their own grants, so the answer comes from asking
 * the one call that needs the grant — the same pattern as `alerts.triage`. The
 * database stays the barrier; this only decides whether to draw the buttons.
 */
export interface SchedulingAccess {
  allowed: boolean;
  /** The caller's own professional id; `null` when there is no active profile. */
  professional_id: string | null;
}

export interface AppointmentInput {
  patient_id: string;
  appointment_type_id: string;
  title: string;
  /** ISO 8601 UTC. */
  starts_at: string;
  ends_at: string;
  location_label: string;
  /** `"me"` books the caller's own agenda; otherwise a professional id. */
  professional: "me" | string;
  /** The area the session belongs to. Decides who sees it — Psychology stays in Psychology. */
  origin_specialty: Especialidade | null;
  /** Text the patient reads in the app. Not a clinical note. */
  patient_notes: string | null;
}

/** The outcomes a professional can record; rescheduling has its own call. */
export type AppointmentOutcome = "completed" | "cancelled" | "no_show";

export interface AppointmentTypeOption {
  id: string;
  label: string;
}
