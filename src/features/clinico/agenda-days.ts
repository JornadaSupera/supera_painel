import { addDays, dayStart, instantParts, minutesOfTime, segmentOnDay, weekdayOf } from "@/lib/agenda";
import type { BusinessHour, PersonalBlock } from "@/types/agenda";
import type { CompromissoAgenda } from "@/types/clinico";

/**
 * Everything one day of the agenda draws, already cut to that day.
 *
 * The three views (month, week, day) read the same shape, so a block that runs
 * over a weekend is clipped once, here, instead of three times in three views.
 */

export interface DayAppointment {
  appointment: CompromissoAgenda;
  /** Minutes since midnight, clipped to the day. */
  start: number;
  end: number;
}

export interface DayBlock {
  block: PersonalBlock;
  start: number;
  end: number;
  /** The block began on an earlier day or goes on to a later one. */
  continues: boolean;
}

export interface AgendaDay {
  key: string;
  appointments: DayAppointment[];
  blocks: DayBlock[];
  /** When the clinic is open that day, in minutes. Empty when it is closed. */
  open: { start: number; end: number }[];
}

export function buildAgendaDays(
  keys: string[],
  appointments: CompromissoAgenda[],
  blocks: PersonalBlock[],
  hours: BusinessHour[],
): AgendaDay[] {
  return keys.map((key) => {
    const dayAppointments: DayAppointment[] = [];
    for (const appointment of appointments) {
      if (instantParts(appointment.inicio).key !== key) continue;

      const segment = segmentOnDay(key, appointment.inicio, appointment.fim);
      if (segment) dayAppointments.push({ appointment, ...segment });
    }

    const dayBlocks: DayBlock[] = [];
    for (const block of blocks) {
      const segment = segmentOnDay(key, block.starts_at, block.ends_at);
      if (!segment) continue;

      dayBlocks.push({
        block,
        ...segment,
        continues:
          Date.parse(block.starts_at) < Date.parse(dayStart(key)) ||
          Date.parse(block.ends_at) > Date.parse(dayStart(addDays(key, 1))),
      });
    }

    const weekday = weekdayOf(key);
    const open = hours
      .filter((hour) => hour.weekday === weekday)
      .map((hour) => ({ start: minutesOfTime(hour.opens_at), end: minutesOfTime(hour.closes_at) }));

    return {
      key,
      appointments: dayAppointments.sort((a, b) => a.start - b.start),
      blocks: dayBlocks.sort((a, b) => a.start - b.start),
      open,
    };
  });
}
