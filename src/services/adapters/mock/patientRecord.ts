import { ESPECIALIDADE } from "@/lib/enums";
import type { Especialidade } from "@/lib/enums";
import { specialtyNoteError, timelineWindowStart } from "@/lib/patient-record";
import { diarySymptomsByEntry, mockConfidentialSpecialties, patientRecordEvents } from "@/mocks/patientRecord";
import { ERROR_CODE, fail, ok, okOne, type ListResult, type SingleResult } from "@/services/contracts";
import type { AppointmentRecordEvent, DiarySymptom, PatientTimeline, RecordEvent } from "@/types/patient-record";
import { autorDaSessao } from "./auth";
import { now, simulate } from "./_helpers";

/**
 * Patient record — mock mode. Data in `mocks/patientRecord.ts`.
 *
 * Secrecy is reproduced the way the database does it: what belongs to a
 * confidential specialty does not come back for anyone outside it, and the flag
 * always does. The mock keeps no rule of its own beyond that.
 */

function viewerSpecialty(): Especialidade | null {
  return autorDaSessao()?.especialidade ?? null;
}

function isWithheld(event: RecordEvent, viewer: Especialidade | null): boolean {
  if (event.kind === "flag" || event.specialty === null) return false;
  const confidential = (mockConfidentialSpecialties as readonly string[]).includes(event.specialty);
  return confidential && event.specialty !== viewer;
}

export async function getPatientTimeline(params: {
  patientId: string;
  days: number | null;
}): Promise<SingleResult<PatientTimeline>> {
  return simulate(() => {
    const from = timelineWindowStart(params.days);
    const viewer = viewerSpecialty();

    const readable = patientRecordEvents
      .filter((event) => event.patient_id === params.patientId && !isWithheld(event, viewer))
      .map(({ patient_id: _patientId, ...event }) => event as RecordEvent);

    const events = readable
      .filter((event) => from === null || event.occurred_at >= from)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

    const nextAppointment =
      readable
        .filter(
          (event): event is AppointmentRecordEvent =>
            event.kind === "appointment" &&
            event.status_label !== "Cancelado" &&
            event.occurred_at > now(),
        )
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0] ?? null;

    return okOne<PatientTimeline>({
      events,
      next_appointment: nextAppointment,
      confidential_specialties: [...mockConfidentialSpecialties],
    });
  });
}

export async function listDiarySymptoms(params: { entryId: string }): Promise<ListResult<DiarySymptom>> {
  return simulate(() =>
    ok((diarySymptomsByEntry[params.entryId] ?? []).slice().sort((a, b) => b.grade - a.grade)),
  );
}

export async function raiseDistressFlag(params: { noteId: string }): Promise<SingleResult<null>> {
  return simulate(() => {
    const note = patientRecordEvents.find((event) => event.kind === "note" && event.id === params.noteId);
    if (note?.kind !== "note" || !note.mine) {
      return fail(ERROR_CODE.FORBIDDEN, "Só dá para sinalizar uma anotação sua.");
    }

    // One flag per note — the database's unique constraint.
    if (patientRecordEvents.some((event) => event.kind === "flag" && event.id === `flag-${note.id}`)) {
      return fail(ERROR_CODE.CONFLICT, "Esta anotação já foi sinalizada.");
    }

    const author = autorDaSessao();
    patientRecordEvents.push({
      patient_id: note.patient_id,
      kind: "flag",
      id: `flag-${note.id}`,
      occurred_at: now(),
      specialty: note.specialty,
      raised_by_name: author?.nome ?? "Você",
    });
    return okOne(null);
  });
}

export async function addSpecialtyNote(params: {
  patientId: string;
  specialty: Especialidade;
  body: string;
  flagDistress?: boolean;
}): Promise<SingleResult<{ note_id: string }>> {
  const result = await simulate(() => {
    const invalid = specialtyNoteError(params.body);
    if (invalid) return fail(ERROR_CODE.VALIDATION, invalid);

    // The insert policy: a professional writes in their own area only.
    if (params.specialty !== viewerSpecialty()) {
      return fail(ERROR_CODE.FORBIDDEN, "Você só escreve anotações na sua própria área de atuação.");
    }

    const id = crypto.randomUUID();
    patientRecordEvents.push({
      patient_id: params.patientId,
      kind: "note",
      id,
      occurred_at: now(),
      specialty: params.specialty,
      body: params.body.trim(),
      author_name: autorDaSessao()?.nome ?? "Você",
      mine: true,
      // Psychology tightens by property of the specialty, not by the author's choice.
      restricted: params.specialty === ESPECIALIDADE.PSICOLOGO,
    });

    return okOne({ note_id: id });
  });

  if (result.error || !params.flagDistress || !result.data) return result;

  const flagged = await raiseDistressFlag({ noteId: result.data.note_id });
  if (flagged.error) {
    return fail(
      ERROR_CODE.UNKNOWN,
      `A anotação foi salva, mas a sinalização não saiu: ${flagged.error.message} Use "Sinalizar sofrimento" na própria anotação.`,
      { noteSaved: true, noteId: result.data.note_id },
    );
  }

  return result;
}
