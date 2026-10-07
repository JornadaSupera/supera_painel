import { useParams } from "react-router-dom";

import { DistressFlagBanner } from "@/features/clinico/components/DistressFlagNotice";
import { PatientChatShortcut } from "@/features/clinico/components/PatientChatShortcut";
import { PatientScheduleShortcut } from "@/features/clinico/components/PatientScheduleShortcut";
import { PacienteFichaPage } from "@/features/pacientes/pages/PacienteFichaPage";
import { ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import { usePatientRecordTabs } from "./usePatientRecordTabs";

/**
 * The patient record, inside the clinical frame.
 *
 * Same page the administrative panel uses; the way back stays in the clinical
 * panel, so a professional never lands in the other panel's navigation by
 * opening a patient. The professional reads the tabs from their own area and
 * writes in it, and gets the shortcuts to the patient's chat and to a new
 * appointment. Composed here because a feature does not import another feature.
 */
export function ClinicalPatientRecord() {
  const { especialidade, id = "" } = useParams<{ especialidade: string; id: string }>();
  const area = especialidade as Especialidade;
  const base = `/clinico/${area}`;
  const chatHref = `${base}/chat?paciente=${id}`;

  const tabs = usePatientRecordTabs({ patientId: id, area, chatHref });

  return (
    <PacienteFichaPage
      basePath={`${base}/pacientes`}
      eyebrow={ESPECIALIDADE_LABEL[area]}
      notice={<DistressFlagBanner patientId={id} />}
      actions={(paciente) => (
        <>
          <PatientChatShortcut href={chatHref} />
          <PatientScheduleShortcut patient={{ id: paciente.id, name: paciente.nome }} area={area} />
        </>
      )}
      tabs={tabs}
    />
  );
}

export default ClinicalPatientRecord;
