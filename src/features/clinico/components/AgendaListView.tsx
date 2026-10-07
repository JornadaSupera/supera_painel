import { CircleCheck, LockKeyhole } from "lucide-react";

import { StatusBadge } from "@/components/shared";
import { dayOfMonth, timeOfMinutes, weekdayShort } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import type { PersonalBlock } from "@/types/agenda";
import type { CompromissoAgenda } from "@/types/clinico";
import type { AgendaDay } from "../agenda-days";
import { isConfirmed } from "../agenda-confirmation";
import { BLOCK_PATTERN } from "../agenda-tones";

/**
 * The days as a list: one card per day, the appointments one under the other.
 *
 * It answers "who is coming, and when" at a glance, where the grid answers "how
 * the hours are filled". A day the clinic does not open and nobody booked is
 * left out, so a week read from a Friday runs straight into Monday.
 *
 * An appointment opens its dialog — details, the way to the record, and the
 * actions for whoever runs the schedule — never the record directly.
 */

type Row =
  | { kind: "appointment"; start: number; appointment: CompromissoAgenda }
  | { kind: "block"; start: number; end: number; block: PersonalBlock };

/** "15/5" — day and month, the way the week reads on paper. */
function shortDate(key: string): string {
  return `${dayOfMonth(key)}/${Number(key.slice(5, 7))}`;
}

function rowsOf(day: AgendaDay): Row[] {
  return [
    ...day.appointments.map<Row>(({ appointment, start }) => ({ kind: "appointment", start, appointment })),
    ...day.blocks.map<Row>(({ block, start, end }) => ({ kind: "block", start, end, block })),
  ].sort((a, b) => a.start - b.start);
}

function AppointmentRow({
  appointment,
  start,
  now,
  onOpen,
}: {
  appointment: CompromissoAgenda;
  start: number;
  now: Date;
  onOpen: (appointment: CompromissoAgenda) => void;
}) {
  const confirmed = isConfirmed(appointment);
  // Still ahead and still scheduled is the ordinary case, and reads without a
  // badge. Anything else — done, missed, cancelled, past with no outcome — says so.
  const ordinary = appointment.status_codigo === "scheduled" && Date.parse(appointment.fim) >= now.getTime();

  return (
    <button
      type="button"
      onClick={() => onOpen(appointment)}
      aria-label={`${timeOfMinutes(start)}, ${appointment.paciente_nome}, ${appointment.titulo}, ${appointment.status_label}${confirmed ? ", confirmada pelo paciente" : ""}. Abrir detalhes`}
      // Time beside the name when the day is wide enough (five days, as in the
      // prototype); above it when seven days share the row.
      className="hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col gap-0.5 px-3 py-2.5 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset @min-[11rem]:flex-row @min-[11rem]:items-start @min-[11rem]:gap-3"
    >
      <span className="text-muted-foreground pt-px font-mono text-xs tabular-nums">{timeOfMinutes(start)}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-1 text-sm font-medium">
          <span className="truncate">{appointment.paciente_nome}</span>
          {confirmed && <CircleCheck size={13} aria-hidden="true" className="text-success shrink-0" />}
        </span>
        <span className="text-muted-foreground truncate text-[11px]">{appointment.titulo}</span>
        {!ordinary && (
          <StatusBadge tone={appointment.status_tom} size="sm" className="w-fit">
            {appointment.status_label}
          </StatusBadge>
        )}
      </span>
    </button>
  );
}

export function AgendaListView({
  days,
  today,
  now,
  onOpen,
  onEditBlock,
}: {
  days: AgendaDay[];
  today: string;
  now: Date;
  onOpen: (appointment: CompromissoAgenda) => void;
  onEditBlock: (block: PersonalBlock) => void;
}) {
  const shown = days.filter(
    (day) => day.open.length > 0 || day.appointments.length > 0 || day.blocks.length > 0,
  );

  if (shown.length === 0) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        A clínica não abre nestes dias e não há nada marcado.
      </p>
    );
  }

  return (
    // Seven columns of 8rem fit from 1280px with the menu open; narrower than
    // that the strip scrolls sideways instead of squeezing names into nothing.
    <div className="flex flex-col gap-3 md:grid md:auto-cols-[minmax(8rem,1fr)] md:grid-flow-col md:gap-2 md:overflow-x-auto md:pb-1">
      {shown.map((day) => {
        const isToday = day.key === today;
        const rows = rowsOf(day);
        const headingId = `agenda-dia-${day.key}`;

        return (
          <section
            key={day.key}
            aria-labelledby={headingId}
            className={cn(
              "bg-card @container flex flex-col overflow-hidden rounded-2xl border",
              isToday && "border-primary/40",
            )}
          >
            <header
              className={cn(
                "flex items-start justify-between gap-2 border-b px-3 py-2",
                isToday && "bg-muted/60",
              )}
            >
              <div className="flex flex-col items-start gap-1">
                <h3
                  id={headingId}
                  className={cn("text-sm font-semibold capitalize", isToday && "text-primary-ink")}
                  aria-current={isToday ? "date" : undefined}
                >
                  {weekdayShort(day.key)}
                  <span className="sr-only">, {shortDate(day.key)}</span>
                </h3>
                {isToday && (
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-px text-[11px] font-medium">
                    hoje
                  </span>
                )}
              </div>
              <span aria-hidden="true" className="text-muted-foreground text-xs tabular-nums">
                {shortDate(day.key)}
              </span>
            </header>

            {rows.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-xs">
                {day.open.length === 0 ? "Clínica fechada" : "Nenhum compromisso"}
              </p>
            ) : (
              <ol className="divide-y">
                {rows.map((row) => (
                  <li key={row.kind === "appointment" ? row.appointment.id : `${row.block.id}-${day.key}`}>
                    {row.kind === "appointment" ? (
                      <AppointmentRow
                        appointment={row.appointment}
                        start={row.start}
                        now={now}
                        onOpen={onOpen}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEditBlock(row.block)}
                        aria-label={`Bloqueio${row.block.label ? `: ${row.block.label}` : ""}, ${timeOfMinutes(row.start)} a ${timeOfMinutes(row.end)}. Editar`}
                        className={cn(
                          "focus-visible:ring-ring flex w-full items-center gap-3 px-3 py-2 text-left text-xs focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset",
                          BLOCK_PATTERN,
                        )}
                      >
                        <span className="font-mono tabular-nums">{timeOfMinutes(row.start)}</span>
                        <span className="bg-card/80 flex items-center gap-1 rounded px-1 font-medium">
                          <LockKeyhole size={11} aria-hidden="true" />
                          {row.block.label ?? "Bloqueio"}
                        </span>
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}

export default AgendaListView;
