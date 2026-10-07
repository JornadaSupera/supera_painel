import { useParams } from "react-router-dom";

import { PatientAgendaTab } from "@/features/clinico/components/PatientAgendaTab";
import { PatientChatShortcut } from "@/features/clinico/components/PatientChatShortcut";
import { PatientDiaryTab } from "@/features/clinico/components/PatientDiaryTab";
import { PatientRecordPanel } from "@/features/clinico/components/PatientRecordPanel";
import { PatientScheduleShortcut } from "@/features/clinico/components/PatientScheduleShortcut";
import { SpecialtyRecordTab } from "@/features/clinico/components/SpecialtyRecordTab";
import { usePatientDiary } from "@/features/clinico/hooks/usePatientRecord";
import { PacienteFichaPage } from "@/features/pacientes/pages/PacienteFichaPage";
import { ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";

/**
 * The patient record, inside the clinical frame.
 *
 * Same page the administrative panel uses; the way back stays in the clinical
 * panel, so a professional never lands in the other panel's navigation by
 * opening a patient. What only a professional needs comes in as tabs —
 * specialties, diary, agenda and the multidisciplinary notes — plus the
 * shortcuts to the patient's chat and to a new appointment. Composed here
 * because a feature does not import another feature.
 */
export function ClinicalPatientRecord() {
  const { especialidade, id = "" } = useParams<{ especialidade: string; id: string }>();
  const area = especialidade as Especialidade;
  const base = `/clinico/${area}`;
  const chatHref = `${base}/chat?paciente=${id}`;

  // Read here, not only in the tab: the tab's label carries the count. The tab
  // shares the same query, so opening it reads nothing twice.
  const diary = usePatientDiary(id);
  const diaryCount = diary.data
    ? ` (${diary.data.entries.length}${diary.data.capped ? "+" : ""})`
    : "";

  return (
    <PacienteFichaPage
      basePath={`${base}/pacientes`}
      eyebrow={ESPECIALIDADE_LABEL[area]}
      actions={(paciente) => (
        <>
          <PatientChatShortcut href={chatHref} />
          <PatientScheduleShortcut patient={{ id: paciente.id, name: paciente.nome }} area={area} />
        </>
      )}
      tabs={[
        {
          value: "especialidades",
          label: "Especialidades",
          content: <SpecialtyRecordTab patientId={id} area={area} chatHref={chatHref} />,
        },
        { value: "diario", label: `Diário${diaryCount}`, content: <PatientDiaryTab patientId={id} /> },
        { value: "agenda", label: "Agenda", content: <PatientAgendaTab patientId={id} /> },
        {
          value: "anotacoes",
          label: "Anotações",
          content: <PatientRecordPanel patientId={id} area={area} chatHref={chatHref} />,
        },
      ]}
    />
  );
}

export default ClinicalPatientRecord;
