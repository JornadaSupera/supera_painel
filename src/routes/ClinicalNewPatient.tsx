import { useParams } from "react-router-dom";

import { PacienteNovoPage } from "@/features/pacientes/pages/PacienteNovoPage";
import { ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";

/**
 * Patient registration, inside the clinical frame.
 *
 * Same page the administrative panel uses. Cancel and the new record stay in
 * the clinical panel, so registering a patient never drops the professional
 * into the other panel's navigation.
 */
export function ClinicalNewPatient() {
  const { especialidade } = useParams<{ especialidade: string }>();
  const area = especialidade as Especialidade;

  return (
    <PacienteNovoPage basePath={`/clinico/${area}/pacientes`} eyebrow={ESPECIALIDADE_LABEL[area]} />
  );
}

export default ClinicalNewPatient;
