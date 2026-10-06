import { CircleCheck, LockKeyhole } from "lucide-react";

import { dayOfMonth, monthOf, timeOfMinutes, weekdayShort } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import type { AgendaDay } from "../agenda-days";
import { isConfirmed } from "../agenda-confirmation";
import { APPOINTMENT_CARD_TONE } from "../agenda-tones";

/**
 * The month as a grid of days, Monday first.
 *
 * It answers "how loaded is each day", not "who is coming": every appointment is
 * a line with its time and kind, and the day is a way into the day view. Patient
 * names are left out on purpose — the month would need one audited read per
 * patient to print them, and nobody reads a name at this size.
 */

const MAX_LINES = 3;

export function AgendaMonthView({
  weeks,
  today,
  month,
  onOpenDay,
}: {
  weeks: AgendaDay[][];
  today: string;
  /** Any day of the month being shown, to dim the neighbors. */
  month: string;
  onOpenDay: (key: string) => void;
}) {
  const shown = monthOf(month);
  const headings = weeks[0] ?? [];

  return (
    <div className="bg-card overflow-x-auto rounded-2xl border">
      <div className="grid min-w-[640px] grid-cols-7">
        {headings.map((day) => (
          <div
            key={day.key}
            className="text-muted-foreground border-b px-2 py-2 text-center text-xs font-medium capitalize"
          >
            {weekdayShort(day.key)}
          </div>
        ))}

        {weeks.flat().map((day) => {
          const isToday = day.key === today;
          const outside = monthOf(day.key) !== shown;
          const closed = day.open.length === 0;
          const extra = day.appointments.length - MAX_LINES;

          const summary = [
            `${dayOfMonth(day.key)}`,
            day.appointments.length === 0
              ? "sem compromissos"
              : `${day.appointments.length} ${day.appointments.length === 1 ? "compromisso" : "compromissos"}`,
            day.blocks.length > 0 ? `${day.blocks.length} ${day.blocks.length === 1 ? "bloqueio" : "bloqueios"}` : null,
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onOpenDay(day.key)}
              aria-label={`Abrir o dia ${summary}`}
              aria-current={isToday ? "date" : undefined}
              className={cn(
                "hover:bg-muted/60 focus-visible:ring-ring flex min-h-28 flex-col items-stretch gap-1 border-t border-l p-1.5 text-left first:border-l-0 focus-visible:z-10 focus-visible:ring-2 focus-visible:outline-none",
                closed && "bg-muted/40",
                outside && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center self-end rounded-full text-xs font-semibold tabular-nums",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {dayOfMonth(day.key)}
              </span>

              {day.appointments.slice(0, MAX_LINES).map(({ appointment, start }) => (
                <span
                  key={appointment.id}
                  className={cn(
                    "truncate rounded border-l-2 px-1 py-px text-[11px] leading-tight",
                    APPOINTMENT_CARD_TONE[appointment.status_tom],
                  )}
                >
                  <span className="font-semibold tabular-nums">{timeOfMinutes(start)}</span>{" "}
                  {isConfirmed(appointment) && (
                    <>
                      <CircleCheck size={10} aria-hidden="true" className="text-success inline align-middle" />
                      <span className="sr-only">confirmada, </span>{" "}
                    </>
                  )}
                  {appointment.tipo_label}
                </span>
              ))}

              {extra > 0 && <span className="text-muted-foreground px-1 text-[11px]">+{extra} mais</span>}

              {day.blocks.length > 0 && (
                <span className="text-muted-foreground mt-auto flex items-center gap-1 px-1 text-[11px]">
                  <LockKeyhole size={11} aria-hidden="true" />
                  {day.blocks.length === 1 ? (day.blocks[0]?.block.label ?? "Bloqueio") : `${day.blocks.length} bloqueios`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default AgendaMonthView;
