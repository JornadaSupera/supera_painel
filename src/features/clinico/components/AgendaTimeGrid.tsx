import { useMemo, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/shared";
import {
  placeOverlaps,
  timeOfMinutes,
  weekdayShort,
  dayOfMonth,
} from "@/lib/agenda";
import { cn } from "@/lib/utils";
import type { PersonalBlock } from "@/types/agenda";
import type { AgendaDay } from "../agenda-days";
import { APPOINTMENT_CARD_TONE, BLOCK_PATTERN } from "../agenda-tones";

/**
 * The hour-by-hour grid behind the week and the day views.
 *
 * One column per day, one row per hour. What the clinic is closed for is shaded,
 * blocks are hatched, and appointments that overlap sit side by side. The visible
 * hours stretch to include anything that falls outside the clinic's day, so a
 * 7 a.m. appointment is never cut off by a grid that starts at 8.
 */

const HOUR_PX = 56;
const MIN_CARD_PX = 22;
/** Below this a card has no room for the status badge under the text. */
const BADGE_MIN_PX = 70;
const DEFAULT_FROM = 7 * 60;
const DEFAULT_TO = 19 * 60;

function visibleRange(days: AgendaDay[]): { from: number; to: number } {
  let from = DEFAULT_FROM;
  let to = DEFAULT_TO;

  for (const day of days) {
    for (const interval of day.open) {
      from = Math.min(from, interval.start);
      to = Math.max(to, interval.end);
    }
    // Blocks do not stretch the grid: an all-day block would turn every view
    // into twenty-four rows for the sake of hours nobody works. They are clipped.
    for (const entry of day.appointments) {
      from = Math.min(from, entry.start);
      to = Math.max(to, entry.end);
    }
  }

  // Whole hours, so the labels line up with the lines.
  return { from: Math.floor(from / 60) * 60, to: Math.min(24 * 60, Math.ceil(to / 60) * 60) };
}

export function AgendaTimeGrid({
  days,
  today,
  recordHref,
  onOpenDay,
  onEditBlock,
}: {
  days: AgendaDay[];
  today: string;
  /** Where an appointment leads, or `null` when the person cannot open records. */
  recordHref: ((patientId: string) => string) | null;
  /** Makes the day heading a way into the day view. Omitted in the day view itself. */
  onOpenDay?: (key: string) => void;
  onEditBlock: (block: PersonalBlock) => void;
}) {
  const { from, to } = useMemo(() => visibleRange(days), [days]);
  const height = ((to - from) / 60) * HOUR_PX;
  const hours = Array.from({ length: (to - from) / 60 }, (_, index) => from + index * 60);

  const top = (minutes: number) => ((minutes - from) / 60) * HOUR_PX;

  return (
    <div className="bg-card overflow-x-auto rounded-2xl border">
      <div
        className="grid min-w-[640px]"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` } as CSSProperties}
      >
        {/* heading row */}
        <div className="border-b" />
        {days.map((day) => {
          const isToday = day.key === today;
          const label = (
            <>
              <span className="text-muted-foreground text-xs capitalize">{weekdayShort(day.key)}</span>
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {dayOfMonth(day.key)}
              </span>
            </>
          );

          return (
            <div key={day.key} className="border-b border-l py-2">
              {onOpenDay ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(day.key)}
                  aria-label={`Abrir o dia ${dayOfMonth(day.key)}`}
                  aria-current={isToday ? "date" : undefined}
                  className="hover:bg-muted/60 focus-visible:ring-ring mx-auto flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 focus-visible:ring-2 focus-visible:outline-none"
                >
                  {label}
                </button>
              ) : (
                <div className="flex flex-col items-center gap-0.5" aria-current={isToday ? "date" : undefined}>
                  {label}
                </div>
              )}
            </div>
          );
        })}

        {/* hour labels */}
        <div className="relative" style={{ height }} aria-hidden="true">
          {hours.map((hour) => (
            <span
              key={hour}
              className={cn(
                "text-muted-foreground absolute right-2 text-[11px] tabular-nums",
                // The first label sits under the heading; centered on the line it would be cut.
                hour === from ? "translate-y-0.5" : "-translate-y-1/2",
              )}
              style={{ top: top(hour) }}
            >
              {timeOfMinutes(hour)}
            </span>
          ))}
        </div>

        {/* day columns */}
        {days.map((day) => {
          const laidOut = placeOverlaps(
            day.appointments.map((entry) => ({ item: entry, start: entry.start, end: entry.end })),
          );
          const closed = day.open.length === 0;

          return (
            <div key={day.key} className="relative border-l" style={{ height }}>
              {/* Shading: the whole column when the clinic is closed, the gaps otherwise. */}
              <div aria-hidden="true" className="bg-muted/50 absolute inset-0" />
              {day.open.map((interval) => (
                <div
                  key={interval.start}
                  aria-hidden="true"
                  className="bg-card absolute inset-x-0"
                  style={{ top: top(interval.start), height: ((interval.end - interval.start) / 60) * HOUR_PX }}
                />
              ))}

              {hours.map((hour) => (
                <div
                  key={hour}
                  aria-hidden="true"
                  className="border-border/60 absolute inset-x-0 border-t"
                  style={{ top: top(hour) }}
                />
              ))}

              {closed && (
                <span className="text-muted-foreground absolute inset-x-0 top-2 text-center text-[11px]">
                  Clínica fechada
                </span>
              )}

              {day.blocks.flatMap(({ block, start: rawStart, end: rawEnd, continues }) => {
                const start = Math.max(rawStart, from);
                const end = Math.min(rawEnd, to);
                return end > start ? [{ block, start, end, continues }] : [];
              }).map(({ block, start, end, continues }) => (
                <button
                  key={`${block.id}-${day.key}`}
                  type="button"
                  onClick={() => onEditBlock(block)}
                  className={cn(
                    "focus-visible:ring-ring absolute inset-x-0.5 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] focus-visible:ring-2 focus-visible:outline-none",
                    BLOCK_PATTERN,
                  )}
                  style={{ top: top(start), height: Math.max(MIN_CARD_PX, ((end - start) / 60) * HOUR_PX) }}
                  aria-label={`Bloqueio${block.label ? `: ${block.label}` : ""}, ${timeOfMinutes(start)} a ${timeOfMinutes(end)}. Editar`}
                >
                  <span className="bg-card/80 rounded px-0.5 font-medium">
                    {block.label ?? "Bloqueio"}
                    {continues ? " ↔" : ""}
                  </span>
                </button>
              ))}

              {laidOut.map(({ item, column, columns, start, end }) => {
                const { appointment } = item;
                const width = 100 / columns;
                const cardHeight = Math.max(MIN_CARD_PX, ((end - start) / 60) * HOUR_PX);
                const card = (
                  <>
                    <span className="font-semibold tabular-nums">{timeOfMinutes(start)}</span>{" "}
                    <span className="font-medium">{appointment.paciente_nome}</span>
                    <span className="block truncate opacity-80">{appointment.tipo_label}</span>
                    {/* The status is always in the text; the badge is only drawn where it fits. */}
                    {cardHeight >= BADGE_MIN_PX ? (
                      <StatusBadge tone={appointment.status_tom} size="sm" className="mt-0.5">
                        {appointment.status_label}
                      </StatusBadge>
                    ) : (
                      <span className="sr-only">, {appointment.status_label}</span>
                    )}
                  </>
                );
                const className = cn(
                  "focus-visible:ring-ring absolute overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-[11px] leading-tight shadow-sm focus-visible:ring-2 focus-visible:outline-none",
                  APPOINTMENT_CARD_TONE[appointment.status_tom],
                );
                const style: CSSProperties = {
                  top: top(start),
                  height: cardHeight,
                  left: `calc(${column * width}% + 2px)`,
                  width: `calc(${width}% - 4px)`,
                };
                const title = `${timeOfMinutes(start)} a ${timeOfMinutes(end)} · ${appointment.paciente_nome} · ${appointment.tipo_label} · ${appointment.status_label}`;

                return recordHref ? (
                  <Link
                    key={appointment.id}
                    to={recordHref(appointment.paciente_id)}
                    className={className}
                    style={style}
                    title={title}
                  >
                    {card}
                  </Link>
                ) : (
                  <div key={appointment.id} className={className} style={style} title={title}>
                    {card}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AgendaTimeGrid;
