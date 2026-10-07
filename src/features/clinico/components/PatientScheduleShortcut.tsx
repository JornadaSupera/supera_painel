import { CalendarPlus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { todayKey } from "@/lib/agenda";
import type { Especialidade } from "@/lib/enums";
import { useSchedulingAccess } from "../hooks/useScheduling";
import { AppointmentFormDialog } from "./AppointmentFormDialog";

/**
 * "Nova consulta" from the patient's record: the agenda's own booking dialog,
 * opened with the patient already chosen.
 *
 * Only for whoever manages the schedule. Until the database answers, there is no
 * button: drawing one that the dialog would then refuse is worse than a moment
 * without it.
 */
export function PatientScheduleShortcut({
  patient,
  area,
}: {
  patient: { id: string; name: string };
  /** The booker's own area. */
  area: Especialidade;
}) {
  const access = useSchedulingAccess();
  const [open, setOpen] = useState(false);

  if (access.data?.allowed !== true) return null;

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <CalendarPlus />
        Nova consulta
      </Button>

      <AppointmentFormDialog
        open={open}
        onOpenChange={setOpen}
        appointment={null}
        defaultDay={todayKey()}
        access={access.data}
        area={area}
        patient={patient}
      />
    </>
  );
}

export default PatientScheduleShortcut;
