import type { Especialidade } from "@/lib/enums";
import { specialtyNoteError, timelineWindowStart } from "@/lib/patient-record";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  AppointmentRecordEvent,
  DiarySymptom,
  PatientTimeline,
  RecordEvent,
} from "@/types/patient-record";
import {
  severidadeDoGrau,
  STATUS_ALERTA_POR_CODIGO,
  STATUS_CONVERSA_POR_CODIGO,
  TOM_POR_CODIGO_STATUS,
  TOM_POR_STATUS_ALERTA,
  TOM_POR_STATUS_CONVERSA,
  type AlertRowStatus,
  type ConversationRowStatus,
} from "./_clinicalMaps";
import { executar, falhaDe, profissionalDaSessao, TETO_READ } from "./_helpers";
import { namesById, NO_NAME, professionalNamesQuery, type ProfessionalNameRow } from "./_professionalNames";
import { getSupabaseClient } from "./client";
import { paraCodigoDeEspecialidade, paraEspecialidade } from "./mapping";

/**
 * The patient record — one read per source, put together here.
 *
 * Every source is a `read_*` function that records the access before it answers
 * and runs under the caller's row policies. That is where Psychology's secrecy
 * is kept: appointments, conversations and notes of a confidential specialty
 * simply do not come back for anyone outside it. Nothing below filters for
 * secrecy, on purpose — a filter here would be a second rule that could drift
 * from the database's.
 */

interface DiaryRow {
  id: string;
  entry_date: string;
  free_text: string | null;
  submitted_at: string | null;
  created_at: string;
}

interface AlertRow {
  id: string;
  symptom_id: string | null;
  grade: number;
  status: AlertRowStatus;
  conduct_notes: string | null;
  created_at: string;
}

interface ConversationRow {
  id: string;
  subject_id: string | null;
  status: ConversationRowStatus;
  origin_specialty_id: string | null;
  last_message_at: string;
}

interface AppointmentRow {
  id: string;
  appointment_type_id: string | null;
  status_id: string | null;
  starts_at: string;
  ends_at: string;
  location_label: string | null;
  origin_specialty_id: string | null;
}

interface NoteRow {
  id: string;
  origin_specialty_id: string;
  visibility: "team" | "specialty_restricted";
  author_professional_id: string;
  body: string;
  created_at: string;
}

interface FlagRow {
  id: string;
  origin_specialty_id: string;
  raised_by_professional_id: string;
  created_at: string;
}

interface SpecialtyRow {
  id: string;
  code: string;
  is_confidential: boolean;
}

/** Per source, how many rows one timeline asks for. The database caps a read at 200 anyway. */
const ROWS_PER_SOURCE = 100;

function idsOf<T>(rows: T[], pick: (row: T) => string | null | undefined): string[] {
  return [...new Set(rows.map(pick).filter((id): id is string => Boolean(id)))];
}

export async function getPatientTimeline(params: {
  patientId: string;
  days: number | null;
}): Promise<SingleResult<PatientTimeline>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const me = await profissionalDaSessao();
    if ("error" in me) return me;

    const now = Date.now();
    const from = timelineWindowStart(params.days, now);
    const inWindow = (instant: string) => from === null || instant >= from;

    const [diary, alerts, conversations, appointments, notes, flags, specialtiesRes] = await Promise.all([
      supabase.rpc("read_diary_entries", {
        p_patient_id: params.patientId,
        p_limit: ROWS_PER_SOURCE,
        p_before: null,
      }),
      supabase.rpc("read_patient_alerts", {
        p_patient_id: params.patientId,
        p_limit: ROWS_PER_SOURCE,
        p_before: null,
      }),
      supabase.rpc("read_conversations", {
        p_patient_id: params.patientId,
        p_limit: 50,
        p_offset: 0,
      }),
      supabase.rpc("read_appointments", {
        p_patient_id: params.patientId,
        p_from: from,
        p_to: null,
        p_limit: TETO_READ,
      }),
      supabase.rpc("read_specialty_notes", {
        p_patient_id: params.patientId,
        p_limit: ROWS_PER_SOURCE,
        p_before: null,
      }),
      supabase.rpc("read_specialty_flags", { p_patient_id: params.patientId }),
      supabase.from("specialties").select("id, code, is_confidential"),
    ]);

    for (const source of [diary, alerts, conversations, appointments, notes, flags, specialtiesRes]) {
      if (source.error) return falhaDe(source.error);
    }

    const diaryRows = ((diary.data ?? []) as DiaryRow[]).filter((row) =>
      inWindow(row.submitted_at ?? row.created_at),
    );
    const alertRows = ((alerts.data ?? []) as AlertRow[]).filter((row) => inWindow(row.created_at));
    const conversationRows = ((conversations.data ?? []) as ConversationRow[]).filter((row) =>
      inWindow(row.last_message_at),
    );
    const appointmentRows = (appointments.data ?? []) as AppointmentRow[];
    const noteRows = ((notes.data ?? []) as NoteRow[]).filter((row) => inWindow(row.created_at));
    const flagRows = ((flags.data ?? []) as FlagRow[]).filter((row) => inWindow(row.created_at));
    const specialtyRows = (specialtiesRes.data ?? []) as SpecialtyRow[];

    const specialtyById = new Map(specialtyRows.map((row) => [row.id, paraEspecialidade(row.code)]));
    const specialtyOf = (id: string | null): Especialidade | null =>
      id ? (specialtyById.get(id) ?? null) : null;

    // The lookups that turn ids into words. Each is one small query, and only for
    // what the rows above actually mention.
    const symptomIds = idsOf(alertRows, (row) => row.symptom_id);
    const subjectIds = idsOf(conversationRows, (row) => row.subject_id);
    const typeIds = idsOf(appointmentRows, (row) => row.appointment_type_id);
    const statusIds = idsOf(appointmentRows, (row) => row.status_id);
    const professionalIds = [
      ...new Set([
        ...noteRows.map((row) => row.author_professional_id),
        ...flagRows.map((row) => row.raised_by_professional_id),
      ]),
    ];

    const empty = <T>() => Promise.resolve({ data: [] as T[], error: null });

    const [symptomsRes, subjectsRes, typesRes, statusesRes, professionalsRes] = await Promise.all([
      symptomIds.length
        ? supabase.from("symptoms").select("id, label").in("id", symptomIds)
        : empty<{ id: string; label: string }>(),
      subjectIds.length
        ? supabase.from("conversation_subjects").select("id, label").in("id", subjectIds)
        : empty<{ id: string; label: string }>(),
      typeIds.length
        ? supabase.from("appointment_types").select("id, label").in("id", typeIds)
        : empty<{ id: string; label: string }>(),
      statusIds.length
        ? supabase.from("appointment_statuses").select("id, code, label").in("id", statusIds)
        : empty<{ id: string; code: string; label: string }>(),
      professionalIds.length
        ? professionalNamesQuery(supabase, professionalIds)
        : empty<ProfessionalNameRow>(),
    ]);

    for (const lookup of [symptomsRes, subjectsRes, typesRes, statusesRes, professionalsRes]) {
      if (lookup.error) return falhaDe(lookup.error);
    }

    const symptomLabel = new Map((symptomsRes.data ?? []).map((row) => [row.id, row.label]));
    const subjectLabel = new Map((subjectsRes.data ?? []).map((row) => [row.id, row.label]));
    const typeLabel = new Map((typesRes.data ?? []).map((row) => [row.id, row.label]));
    const statusById = new Map((statusesRes.data ?? []).map((row) => [row.id, row]));
    const professionalName = namesById((professionalsRes.data ?? []) as ProfessionalNameRow[]);

    const appointmentEvents = appointmentRows.map<AppointmentRecordEvent>((row) => {
      const status = row.status_id ? statusById.get(row.status_id) : undefined;
      return {
        kind: "appointment",
        id: row.id,
        occurred_at: row.starts_at,
        specialty: specialtyOf(row.origin_specialty_id),
        type_label: (row.appointment_type_id && typeLabel.get(row.appointment_type_id)) || "Compromisso",
        status_label: status?.label ?? "—",
        status_tone: (status && TOM_POR_CODIGO_STATUS[status.code]) || "neutral",
        ends_at: row.ends_at,
        location: row.location_label,
      };
    });

    // Only a scheduled appointment can be "next": a cancelled or rescheduled one
    // in the future is not coming.
    const scheduledIds = new Set(
      appointmentRows
        .filter((row) => row.status_id && statusById.get(row.status_id)?.code === "scheduled")
        .map((row) => row.id),
    );
    const nextAppointment =
      appointmentEvents
        .filter((event) => scheduledIds.has(event.id) && new Date(event.occurred_at).getTime() > now)
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0] ?? null;

    const events: RecordEvent[] = [
      ...diaryRows.map<RecordEvent>((row) => ({
        kind: "diary",
        id: row.id,
        occurred_at: row.submitted_at ?? row.created_at,
        specialty: null,
        entry_date: row.entry_date,
        free_text: row.free_text?.trim() || null,
      })),
      ...alertRows.map<RecordEvent>((row) => {
        const status = STATUS_ALERTA_POR_CODIGO[row.status];
        return {
          kind: "alert",
          id: row.id,
          occurred_at: row.created_at,
          specialty: null,
          symptom_label: (row.symptom_id && symptomLabel.get(row.symptom_id)) || "Sintoma",
          grade: row.grade,
          severity: severidadeDoGrau(row.grade),
          status,
          status_tone: TOM_POR_STATUS_ALERTA[status],
          conduct_notes: row.conduct_notes,
        };
      }),
      ...conversationRows.map<RecordEvent>((row) => {
        const status = STATUS_CONVERSA_POR_CODIGO[row.status];
        return {
          kind: "conversation",
          id: row.id,
          conversation_id: row.id,
          occurred_at: row.last_message_at,
          specialty: specialtyOf(row.origin_specialty_id),
          subject_label: (row.subject_id && subjectLabel.get(row.subject_id)) || "Outros",
          status,
          status_tone: TOM_POR_STATUS_CONVERSA[status],
        };
      }),
      ...appointmentEvents.filter((event) => inWindow(event.occurred_at)),
      ...noteRows.map<RecordEvent>((row) => ({
        kind: "note",
        id: row.id,
        occurred_at: row.created_at,
        specialty: specialtyOf(row.origin_specialty_id),
        body: row.body,
        author_name: professionalName.get(row.author_professional_id) ?? NO_NAME,
        mine: row.author_professional_id === me.profissionalId,
        restricted: row.visibility === "specialty_restricted",
      })),
      ...flagRows.map<RecordEvent>((row) => ({
        kind: "flag",
        id: row.id,
        occurred_at: row.created_at,
        specialty: specialtyOf(row.origin_specialty_id),
        raised_by_name: professionalName.get(row.raised_by_professional_id) ?? NO_NAME,
      })),
    ].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

    return okOne<PatientTimeline>({
      events,
      next_appointment: nextAppointment,
      confidential_specialties: specialtyRows
        .filter((row) => row.is_confidential)
        .map((row) => paraEspecialidade(row.code))
        .filter((specialty): specialty is Especialidade => specialty !== null),
    });
  });
}

export async function listDiarySymptoms(params: { entryId: string }): Promise<ListResult<DiarySymptom>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase.rpc("read_diary_symptom_reports", {
      p_diary_entry_id: params.entryId,
    });
    if (error) return falhaDe(error);

    const rows = (data ?? []) as { id: string; symptom_id: string; grade: number }[];
    if (rows.length === 0) return ok([]);

    const { data: symptoms, error: symptomsError } = await supabase
      .from("symptoms")
      .select("id, label")
      .in("id", idsOf(rows, (row) => row.symptom_id));
    if (symptomsError) return falhaDe(symptomsError);

    const label = new Map((symptoms ?? []).map((row) => [row.id, row.label]));

    return ok(
      rows
        .map<DiarySymptom>((row) => ({
          id: row.id,
          symptom_label: label.get(row.symptom_id) ?? "Sintoma",
          grade: row.grade,
        }))
        .sort((a, b) => b.grade - a.grade || a.symptom_label.localeCompare(b.symptom_label)),
    );
  });
}

/**
 * `raise_specialty_flag` answers `insufficient_privilege` when the note is not the
 * caller's and `unique_violation` when that note was already flagged. Both are
 * things a person can act on, so both get their own sentence.
 */
function flagFailure(error: Parameters<typeof falhaDe>[0]) {
  if (error?.code === "42501") {
    return fail(ERROR_CODE.FORBIDDEN, "Só dá para sinalizar uma anotação sua.", {
      code: error.code,
      message: error.message,
    });
  }
  if (error?.code === "23505") {
    return fail(ERROR_CODE.CONFLICT, "Esta anotação já foi sinalizada.", {
      code: error.code,
      message: error.message,
    });
  }
  return falhaDe(error);
}

export async function raiseDistressFlag(params: { noteId: string }): Promise<SingleResult<null>> {
  return executar(async () => {
    const { error } = await getSupabaseClient().rpc("raise_specialty_flag", {
      p_source_note_id: params.noteId,
    });
    if (error) return flagFailure(error);
    return okOne(null);
  });
}

/**
 * Writes a note straight into `specialty_notes`, which is the path the database
 * provides: the insert policy checks the specialty and the author against the
 * session. The professional cannot read that table back, so the id is born here
 * and the insert never asks for the row — the timeline is what shows it after.
 */
export async function addSpecialtyNote(params: {
  patientId: string;
  specialty: Especialidade;
  body: string;
  flagDistress?: boolean;
}): Promise<SingleResult<{ note_id: string }>> {
  return executar(async () => {
    const invalid = specialtyNoteError(params.body);
    if (invalid) return fail(ERROR_CODE.VALIDATION, invalid);

    const supabase = getSupabaseClient();

    const me = await profissionalDaSessao();
    if ("error" in me) return me;

    const { data: specialty, error: specialtyError } = await supabase
      .from("specialties")
      .select("id")
      .eq("code", paraCodigoDeEspecialidade(params.specialty))
      .maybeSingle();
    if (specialtyError) return falhaDe(specialtyError);
    if (!specialty) return fail(ERROR_CODE.NOT_FOUND, "Especialidade não encontrada.");

    const noteId = crypto.randomUUID();

    const { error } = await supabase.from("specialty_notes").insert({
      id: noteId,
      patient_id: params.patientId,
      origin_specialty_id: specialty.id,
      author_professional_id: me.profissionalId,
      authored_by: me.contaId,
      body: params.body.trim(),
    });
    if (error) {
      if (error.code === "42501") {
        return fail(ERROR_CODE.FORBIDDEN, "Você só escreve anotações na sua própria área de atuação.", {
          code: error.code,
          message: error.message,
        });
      }
      return falhaDe(error);
    }

    if (params.flagDistress) {
      const flagged = await raiseDistressFlag({ noteId });
      if (flagged.error) {
        return fail(
          ERROR_CODE.UNKNOWN,
          `A anotação foi salva, mas a sinalização não saiu: ${flagged.error.message} Use "Sinalizar sofrimento" na própria anotação.`,
          { noteSaved: true, noteId },
        );
      }
    }

    return okOne({ note_id: noteId });
  });
}
