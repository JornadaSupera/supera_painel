import { EmptyState, ErrorState, SectionHeading, SkeletonRows, StatusBadge } from "@/components/shared";
import { relativeDay } from "@/lib/agenda";
import { formatDate, formatTime } from "@/lib/format";
import type { AppointmentRecordEvent } from "@/types/patient-record";
import { confirmationText, isConfirmed } from "../agenda-confirmation";
import { useUpcomingAppointments } from "../hooks/usePatientRecord";

/**
 * What is still to come for the patient, with anyone on the team.
 *
 * Every appointment here is scheduled; the badge says whether the patient has
 * already confirmed attendance in the app. Psychology sessions only show up for
 * whoever the database lets read them.
 */

/** "Amanhã · 08:30", "Em 3 dias · 18/05 · 14:00", or the full date once it is more than a week away. */
function whenItIs(iso: string): string {
  const day = relativeDay(iso);
  const time = formatTime(iso);
  if (day === "Hoje" || day === "Amanhã") return `${day} · ${time}`;
  if (day) return `${day} · ${formatDate(iso).slice(0, 5)} · ${time}`;
  return `${formatDate(iso)} · ${time}`;
}

function UpcomingAppointment({ appointment }: { appointment: AppointmentRecordEvent }) {
  const confirmation = { status_codigo: appointment.status_code, confirmado_em: appointment.confirmed_at };
  const confirmed = isConfirmed(confirmation);

  return (
    <li className="bg-card flex items-start justify-between gap-3 rounded-xl border px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-sm">
          <span className="font-medium">{appointment.title}</span>
          {appointment.type_label !== appointment.title && (
            <span className="text-muted-foreground"> · {appointment.type_label}</span>
          )}
        </p>
        <p className="text-muted-foreground text-xs">
          <time dateTime={appointment.occurred_at} className="tabular-nums">
            {whenItIs(appointment.occurred_at)}
          </time>
          {appointment.location ? ` · ${appointment.location}` : ""}
        </p>
      </div>

      <span title={confirmationText(confirmation)} className="shrink-0">
        <StatusBadge tone={confirmed ? "success" : "neutral"} size="sm" pill>
          {confirmed ? "Confirmado" : "Agendado"}
        </StatusBadge>
      </span>
    </li>
  );
}

export function PatientAgendaTab({ patientId }: { patientId: string }) {
  const upcoming = useUpcomingAppointments(patientId);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="record-agenda-heading">
      <SectionHeading id="record-agenda-heading">Próximos compromissos</SectionHeading>

      {upcoming.isLoading && <SkeletonRows count={3} />}

      {upcoming.isError && (
        <ErrorState error={upcoming.error} onRetry={() => void upcoming.refetch()} compact />
      )}

      {upcoming.data && upcoming.data.length === 0 && (
        <EmptyState
          compact
          title="Nenhum compromisso agendado"
          description="Consultas, sessões e exames marcados com qualquer profissional da equipe aparecem aqui."
        />
      )}

      {upcoming.data && upcoming.data.length > 0 && (
        <ol className="flex flex-col gap-2">
          {upcoming.data.map((appointment) => (
            <UpcomingAppointment key={appointment.id} appointment={appointment} />
          ))}
        </ol>
      )}
    </section>
  );
}

export default PatientAgendaTab;
