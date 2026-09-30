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

/** One opening interval of the clinic. A day can have more than one. */
export interface BusinessHour {
  /** 0 = Sunday. */
  weekday: number;
  /** `"HH:MM"`. */
  opens_at: string;
  closes_at: string;
}

export interface AppointmentTypeOption {
  id: string;
  label: string;
}
