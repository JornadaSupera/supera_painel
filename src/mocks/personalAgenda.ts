import { addDays, dayStart, todayKey, zonedInstant } from "@/lib/agenda";
import type { BusinessHour, PersonalBlock } from "@/types/agenda";

/**
 * The professional's own calendar — mock mode. Dates are relative to today, so
 * the blocks are always in the week being looked at.
 */

export const businessHours: BusinessHour[] = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({ weekday, opens_at: "08:00", closes_at: "18:00" })),
  { weekday: 6, opens_at: "08:00", closes_at: "12:00" },
];

const today = todayKey();

/** Mutable, like the rest of the mocks: creating and removing must show up. */
export const personalBlocks: PersonalBlock[] = [
  {
    id: "mock-block-1",
    label: "Almoço",
    starts_at: zonedInstant(today, 12 * 60),
    ends_at: zonedInstant(today, 13 * 60),
  },
  {
    id: "mock-block-2",
    label: "Reunião de equipe",
    starts_at: zonedInstant(addDays(today, 1), 15 * 60),
    ends_at: zonedInstant(addDays(today, 1), 16 * 60),
  },
  {
    id: "mock-block-3",
    label: "Congresso",
    starts_at: dayStart(addDays(today, 10)),
    ends_at: dayStart(addDays(today, 12)),
  },
];
