import type { StatusTone } from "@/components/shared";
import type { Especialidade, Severidade, StatusAlerta, StatusConversa } from "@/lib/enums";

/**
 * A patient's record as the clinical team sees it: one timeline that puts
 * together what the patient reported, what the team did and what the team wrote.
 *
 * Every event carries the specialty it belongs to when it has one. The diary and
 * the alerts belong to no specialty — they are the patient's own reports — so
 * they stay `null` and show up under every area.
 */

interface RecordEventBase {
  id: string;
  /** ISO 8601 UTC — the moment the event happened, and what the timeline sorts by. */
  occurred_at: string;
  specialty: Especialidade | null;
}

export interface DiaryRecordEvent extends RecordEventBase {
  kind: "diary";
  /** Calendar day the entry refers to (`YYYY-MM-DD`), which can differ from `occurred_at`. */
  entry_date: string;
  free_text: string | null;
}

export interface AlertRecordEvent extends RecordEventBase {
  kind: "alert";
  symptom_label: string;
  grade: number;
  severity: Severidade;
  status: StatusAlerta;
  status_tone: StatusTone;
  conduct_notes: string | null;
}

export interface ConversationRecordEvent extends RecordEventBase {
  kind: "conversation";
  conversation_id: string;
  subject_label: string;
  status: StatusConversa;
  status_tone: StatusTone;
}

export interface AppointmentRecordEvent extends RecordEventBase {
  kind: "appointment";
  /** What whoever booked it called it — "Quimioterapia — Ciclo 4". */
  title: string;
  type_label: string;
  status_label: string;
  status_tone: StatusTone;
  /** Catalog code (`scheduled`, `completed`, …): what decides, while the label is what reads. */
  status_code: string | null;
  ends_at: string;
  location: string | null;
  /** When the patient (or whoever accompanies them) confirmed attendance in the app. */
  confirmed_at: string | null;
}

export interface NoteRecordEvent extends RecordEventBase {
  kind: "note";
  body: string;
  author_name: string;
  /** Written by the signed-in professional — the only notes that can be flagged. */
  mine: boolean;
  /** The database tightened the note to its own specialty (Psychology). */
  restricted: boolean;
}

/**
 * A distress flag raised to the team on a patient. Like the timeline event, it
 * carries no text: who raised it, from which area and when.
 */
export interface DistressFlag {
  id: string;
  specialty: Especialidade | null;
  raised_by_name: string;
  raised_at: string;
}

/** The flag carries no text on purpose: it says that something happened, never what. */
export interface FlagRecordEvent extends RecordEventBase {
  kind: "flag";
  raised_by_name: string;
}

export type RecordEvent =
  | DiaryRecordEvent
  | AlertRecordEvent
  | ConversationRecordEvent
  | AppointmentRecordEvent
  | NoteRecordEvent
  | FlagRecordEvent;

export type RecordEventKind = RecordEvent["kind"];

export interface PatientTimeline {
  /** Newest first. */
  events: RecordEvent[];
  /** The soonest appointment that has not happened yet, whoever it is with. */
  next_appointment: AppointmentRecordEvent | null;
  /**
   * Specialties whose content is under professional secrecy. Read from the
   * catalog, not assumed: the screen only explains a missing area, the database
   * is what actually withholds it.
   */
  confidential_specialties: Especialidade[];
}

/** One symptom reported in a diary entry. */
export interface DiarySymptom {
  id: string;
  symptom_label: string;
  grade: number;
  /** The grade read on the same scale as the alerts, so one grade never gets two colors. */
  severity: Severidade;
}

/** One saved diary entry, without its symptoms — those are one call per entry. */
export interface PatientDiaryEntry {
  id: string;
  /** ISO 8601 UTC — when it was sent. */
  occurred_at: string;
  /** Calendar day the entry refers to (`YYYY-MM-DD`). */
  entry_date: string;
  free_text: string | null;
  /** Written by the caregiver on the patient's behalf, not by the patient. */
  by_caregiver: boolean;
}

export interface PatientDiary {
  /** Newest first. */
  entries: PatientDiaryEntry[];
  /** The database stops at 200 entries per read: past that, the count is a floor. */
  capped: boolean;
}

/**
 * How far back the timeline reaches, in days. `null` reaches as far as the
 * database returns — a ceiling per source, not the whole history.
 */
export type TimelineWindow = 30 | 90 | null;
