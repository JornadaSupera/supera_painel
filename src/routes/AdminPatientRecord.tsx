import { useParams } from "react-router-dom";

import { PacienteFichaPage } from "@/features/pacientes/pages/PacienteFichaPage";
import { usePatientRecordTabs } from "./usePatientRecordTabs";

/**
 * The patient record, inside the administrative frame.
 *
 * The same record in tabs the clinical panel reads, so both panels look at one
 * patient the same way. The administration keeps what is its own — invite,
 * edit, deactivate, unlink the app account — and reads the clinical tabs with no
 * area: no notes to write, no clinical chat to open. Psychology's content stays
 * out because the database does not hand it to an administrator.
 */
export function AdminPatientRecord() {
  const { id = "" } = useParams<{ id: string }>();
  const tabs = usePatientRecordTabs({ patientId: id, area: null, chatHref: null });

  return <PacienteFichaPage tabs={tabs} />;
}

export default AdminPatientRecord;
