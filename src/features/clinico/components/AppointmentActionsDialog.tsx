import { CalendarClock, CalendarX2, CheckCheck, CircleCheck, Clock, LoaderCircle, UserX } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ConfirmDialog, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { instantParts, timeOfMinutes } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import type { AppointmentOutcome } from "@/types/agenda";
import type { CompromissoAgenda } from "@/types/clinico";
import { confirmationText, isConfirmed } from "../agenda-confirmation";
import { useSetAppointmentStatus } from "../hooks/useScheduling";

/**
 * What can be done with a booked appointment: move it, or record how it ended.
 *
 * Only an appointment still `scheduled` gets here. The database does not move an
 * appointment out of a terminal state, so offering "cancel" on one that already
 * happened would be a button that can only answer no.
 *
 * Nothing here decides who may. Whoever cannot see an appointment never gets it
 * in the agenda to click on, and whoever can is refused by the database if they
 * do not run the schedule — the answer reaches the screen as a message.
 */
export function AppointmentActionsDialog({
  appointment,
  onOpenChange,
  onReschedule,
  recordHref,
}: {
  /** `null` is closed. */
  appointment: CompromissoAgenda | null;
  onOpenChange: (open: boolean) => void;
  onReschedule: (appointment: CompromissoAgenda) => void;
  /** Where the patient record is, or `null` when this person cannot open it. */
  recordHref: ((patientId: string) => string) | null;
}) {
  const setStatus = useSetAppointmentStatus();
  const [confirmingCancel, setConfirmingCancel] = useState(false);

  const record = (outcome: AppointmentOutcome, reason?: string) => {
    if (!appointment) return;
    setStatus.mutate(
      { id: appointment.id, outcome, reason },
      {
        onSuccess: () => {
          setConfirmingCancel(false);
          onOpenChange(false);
        },
      },
    );
  };

  const when = appointment
    ? (() => {
        const start = instantParts(appointment.inicio);
        const end = instantParts(appointment.fim);
        const day = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(
          new Date(`${start.key}T12:00:00`),
        );
        return `${day}, ${timeOfMinutes(start.minutes)} às ${timeOfMinutes(end.minutes)}`;
      })()
    : "";

  return (
    <>
      <Dialog open={appointment !== null && !confirmingCancel} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          {appointment && (
            <>
              <DialogHeader>
                <DialogTitle>{appointment.paciente_nome}</DialogTitle>
                <DialogDescription className="first-letter:uppercase">{when}</DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{appointment.tipo_label}</span>
                <StatusBadge tone={appointment.status_tom} size="sm">
                  {appointment.status_label}
                </StatusBadge>
                {appointment.local && <span className="text-muted-foreground">· {appointment.local}</span>}
              </div>

              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm",
                  isConfirmed(appointment) ? "text-success font-medium" : "text-muted-foreground",
                )}
              >
                {isConfirmed(appointment) ? (
                  <CircleCheck size={15} aria-hidden="true" />
                ) : (
                  <Clock size={15} aria-hidden="true" />
                )}
                {confirmationText(appointment)}
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={() => record("completed")}
                >
                  {setStatus.isPending ? <LoaderCircle className="animate-spin" /> : <CheckCheck />}
                  Marcar como realizado
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={() => record("no_show")}
                >
                  <UserX />
                  Paciente faltou
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={() => onReschedule(appointment)}
                >
                  <CalendarClock />
                  Remarcar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  disabled={setStatus.isPending}
                  onClick={() => setConfirmingCancel(true)}
                >
                  <CalendarX2 />
                  Cancelar compromisso
                </Button>
              </div>

              <DialogFooter className="sm:justify-between">
                {recordHref ? (
                  <Button asChild variant="link" className="px-0">
                    <Link to={recordHref(appointment.paciente_id)}>Abrir a ficha do paciente</Link>
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={appointment !== null && confirmingCancel}
        onOpenChange={setConfirmingCancel}
        title="Cancelar este compromisso?"
        description={`${appointment?.paciente_nome ?? "O paciente"} é avisado pelo aplicativo. O compromisso fica como cancelado e não volta a ser marcado.`}
        confirmLabel="Cancelar compromisso"
        cancelLabel="Voltar"
        loading={setStatus.isPending}
        onConfirm={({ reason }) => record("cancelled", reason)}
      />
    </>
  );
}

export default AppointmentActionsDialog;
