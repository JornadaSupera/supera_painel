import { useParams } from "react-router-dom";

import { useCan } from "@/contexts/auth-context";
import { PacienteFichaPage } from "@/features/pacientes/pages/PacienteFichaPage";
import { PatientSatisfactionTab } from "@/features/satisfaction/components/PatientSatisfactionTab";
import { PERMISSAO } from "@/lib/rbac";
import { usePatientRecordTabs } from "./usePatientRecordTabs";

/**
 * The patient record, inside the administrative frame.
 *
 * The same record in tabs the clinical panel reads, so both panels look at one
 * patient the same way. The administration keeps what is its own — invite,
 * edit, deactivate, unlink the app account, the satisfaction survey — and reads
 * the clinical tabs with no area: no notes to write, no clinical chat to open.
 * Psychology's content stays out because the database does not hand it to an
 * administrator.
 */
export function AdminPatientRecord() {
  const { id = "" } = useParams<{ id: string }>();
  const can = useCan();
  const clinicalTabs = usePatientRecordTabs({ patientId: id, area: null, chatHref: null });

  const tabs = can(PERMISSAO.SATISFACAO_READ)
    ? [
        ...clinicalTabs,
        {
          value: "satisfacao",
          label: "Satisfação",
          content: <PatientSatisfactionTab patientId={id} />,
        },
      ]
    : clinicalTabs;

  return <PacienteFichaPage tabs={tabs} />;
}

export default AdminPatientRecord;
