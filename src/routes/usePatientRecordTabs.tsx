import { PatientAgendaTab } from "@/features/clinico/components/PatientAgendaTab";
import { PatientDiaryTab } from "@/features/clinico/components/PatientDiaryTab";
import { PatientRecordPanel } from "@/features/clinico/components/PatientRecordPanel";
import { SpecialtyRecordTab } from "@/features/clinico/components/SpecialtyRecordTab";
import { usePatientDiary } from "@/features/clinico/hooks/usePatientRecord";
import type { RecordTab } from "@/features/pacientes/pages/PacienteFichaPage";
import type { Especialidade } from "@/lib/enums";

/**
 * The tabs after "Geral" — specialties, diary, agenda and the multidisciplinary
 * notes — the same in both panels. Composed here because a feature does not
 * import another feature.
 *
 * The administration passes no area and no chat: it reads every tab and writes
 * in none. What it may read is the database's call — Psychology's content does
 * not reach it — so nothing here hides a tab by role.
 */
export function usePatientRecordTabs({
  patientId,
  area,
  chatHref,
}: {
  patientId: string;
  area: Especialidade | null;
  chatHref: string | null;
}): RecordTab[] {
  // Read here, not only in the tab: the tab's label carries the count. The tab
  // shares the same query, so opening it reads nothing twice.
  const diary = usePatientDiary(patientId);
  const diaryCount = diary.data
    ? ` (${diary.data.entries.length}${diary.data.capped ? "+" : ""})`
    : "";

  return [
    {
      value: "especialidades",
      label: "Especialidades",
      content: (paciente) => <SpecialtyRecordTab patient={paciente} area={area} chatHref={chatHref} />,
    },
    { value: "diario", label: `Diário${diaryCount}`, content: <PatientDiaryTab patientId={patientId} /> },
    { value: "agenda", label: "Agenda", content: <PatientAgendaTab patientId={patientId} /> },
    {
      value: "anotacoes",
      label: "Anotações",
      content: <PatientRecordPanel patientId={patientId} area={area} chatHref={chatHref} />,
    },
  ];
}
