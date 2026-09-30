import type { DiarySymptom, RecordEvent } from "@/types/patient-record";
import { pacientes } from "./pacientes";

/**
 * Patient record — mock mode.
 *
 * Dates are relative to "now": a fixed date ages out of the 30-day window the
 * day the calendar turns the page. The patients are the first of the base — the
 * same ones the agenda and the queues point at — so opening a record from any of
 * those lands on something that exists.
 */

export type MockRecordEvent = RecordEvent & { patient_id: string };

function daysAgo(days: number, hour = 9, minute = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function dateOnly(days: number): string {
  return daysAgo(days).slice(0, 10);
}

function patientId(index: number): string {
  return pacientes[index]?.id ?? "0";
}

const ME = "Você";

export const patientRecordEvents: MockRecordEvent[] = [
  /* -------------------------------------------------------- first patient */
  {
    patient_id: patientId(0),
    kind: "diary",
    id: "mock-diary-0-1",
    occurred_at: daysAgo(1, 20, 10),
    specialty: null,
    entry_date: dateOnly(1),
    free_text: "Dormi mal, com enjoo depois do almoço. Consegui beber bastante água.",
  },
  {
    patient_id: patientId(0),
    kind: "diary",
    id: "mock-diary-0-2",
    occurred_at: daysAgo(4, 19, 40),
    specialty: null,
    entry_date: dateOnly(4),
    free_text: null,
  },
  {
    patient_id: patientId(0),
    kind: "diary",
    id: "mock-diary-0-3",
    occurred_at: daysAgo(40, 21, 0),
    specialty: null,
    entry_date: dateOnly(40),
    free_text: "Dia tranquilo, sem sintomas.",
  },
  {
    patient_id: patientId(0),
    kind: "alert",
    id: "mock-alert-0-1",
    occurred_at: daysAgo(1, 20, 12),
    specialty: null,
    symptom_label: "Náusea",
    grade: 4,
    severity: "alta",
    status: "assumido",
    status_tone: "warning",
    conduct_notes: null,
  },
  {
    patient_id: patientId(0),
    kind: "alert",
    id: "mock-alert-0-2",
    occurred_at: daysAgo(35, 8, 30),
    specialty: null,
    symptom_label: "Fadiga",
    grade: 3,
    severity: "media",
    status: "resolvido",
    status_tone: "success",
    conduct_notes: "Orientado repouso e hidratação; sem necessidade de retorno antecipado.",
  },
  {
    patient_id: patientId(0),
    kind: "conversation",
    id: "mock-conversation-0-1",
    conversation_id: "mock-conversation-0-1",
    occurred_at: daysAgo(2, 15, 20),
    specialty: "farmaceutico",
    subject_label: "Dúvida sobre medicamento",
    status: "resolvida",
    status_tone: "success",
  },
  {
    patient_id: patientId(0),
    kind: "appointment",
    id: "mock-appointment-0-1",
    occurred_at: daysAgo(7, 9, 0),
    specialty: "medico_oncologista",
    type_label: "Consulta médica",
    status_label: "Realizado",
    status_tone: "success",
    ends_at: daysAgo(7, 9, 30),
    location: "Consultório 2",
  },
  {
    patient_id: patientId(0),
    kind: "appointment",
    id: "mock-appointment-0-2",
    occurred_at: daysAgo(-6, 10, 30),
    specialty: "medico_oncologista",
    type_label: "Sessão de quimioterapia",
    status_label: "Agendado",
    status_tone: "info",
    ends_at: daysAgo(-6, 12, 30),
    location: "Sala de Infusão 1",
  },
  {
    patient_id: patientId(0),
    kind: "note",
    id: "mock-note-0-1",
    occurred_at: daysAgo(7, 9, 40),
    specialty: "medico_oncologista",
    body: "Bom estado geral, aceitando bem o ciclo. Mantida a dose; reavaliar náusea na próxima sessão.",
    author_name: "Dr. Ricardo Lemos",
    mine: false,
    restricted: false,
  },
  {
    patient_id: patientId(0),
    kind: "note",
    id: "mock-note-0-2",
    occurred_at: daysAgo(3, 11, 15),
    specialty: "nutricionista",
    body: "Orientada a fracionar as refeições e reduzir gordura no almoço. Trazer o diário alimentar da semana.",
    author_name: "Marina Prado",
    mine: false,
    restricted: false,
  },
  {
    patient_id: patientId(0),
    kind: "note",
    id: "mock-note-0-3",
    occurred_at: daysAgo(5, 14, 0),
    specialty: "psicologo",
    body: "Relata preocupação intensa com o resultado do próximo exame e dificuldade para dormir.",
    author_name: "Dra. Helena Duarte",
    mine: false,
    restricted: true,
  },
  {
    patient_id: patientId(0),
    kind: "flag",
    id: "mock-flag-0-1",
    occurred_at: daysAgo(5, 14, 5),
    specialty: "psicologo",
    raised_by_name: "Dra. Helena Duarte",
  },

  /* ------------------------------------------------------- second patient */
  {
    patient_id: patientId(1),
    kind: "diary",
    id: "mock-diary-1-1",
    occurred_at: daysAgo(2, 18, 30),
    specialty: null,
    entry_date: dateOnly(2),
    free_text: "Sem queixas hoje.",
  },
  {
    patient_id: patientId(1),
    kind: "appointment",
    id: "mock-appointment-1-1",
    occurred_at: daysAgo(-2, 14, 0),
    specialty: "enfermeiro",
    type_label: "Consulta de enfermagem",
    status_label: "Confirmado",
    status_tone: "success",
    ends_at: daysAgo(-2, 14, 30),
    location: "Ambulatório",
  },
  {
    patient_id: patientId(1),
    kind: "note",
    id: "mock-note-1-1",
    occurred_at: daysAgo(10, 10, 0),
    specialty: "enfermeiro",
    body: "Acesso venoso periférico sem intercorrências. Paciente orientado sobre sinais de extravasamento.",
    author_name: ME,
    mine: true,
    restricted: false,
  },
];

/** Symptoms reported in each diary entry, by entry id. Entries not listed here reported none. */
export const diarySymptomsByEntry: Record<string, DiarySymptom[]> = {
  "mock-diary-0-1": [
    { id: "mock-report-1", symptom_label: "Náusea", grade: 4 },
    { id: "mock-report-2", symptom_label: "Insônia", grade: 3 },
    { id: "mock-report-3", symptom_label: "Fadiga", grade: 2 },
  ],
  "mock-diary-0-3": [],
  "mock-diary-1-1": [{ id: "mock-report-4", symptom_label: "Fadiga", grade: 1 }],
};

/** Specialties under professional secrecy in the mock catalog. */
export const mockConfidentialSpecialties = ["psicologo"] as const;
