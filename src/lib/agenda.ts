/**
 * Calendar arithmetic for the professional's agenda.
 *
 * Everything is a **day key** (`YYYY-MM-DD`) plus minutes since midnight, in the
 * clinic's zone. That is the zone `lib/format` already prints times in, so a card
 * is never drawn on one day and labeled with the time of another — which is what
 * happens when the browser's own zone and the clinic's disagree.
 *
 * Adding days works on the calendar, not on instants: a day key moved by seven is
 * the same weekday a week later, with no clock involved.
 */

export const AGENDA_TIME_ZONE = "America/Sao_Paulo";

export const AGENDA_VIEW = { MONTH: "mes", WEEK: "semana", DAY: "dia" } as const;
export type AgendaView = (typeof AGENDA_VIEW)[keyof typeof AGENDA_VIEW];

export const AGENDA_VIEW_LABEL: Record<AgendaView, string> = {
  mes: "Mês",
  semana: "Semana",
  dia: "Dia",
};

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDayKey(value: string | null | undefined): value is string {
  if (!value || !KEY.test(value)) return false;
  // Rejects "2026-02-31": the key must survive a round trip.
  return toKey(fromKey(value)) === value;
}

/** Noon UTC: far from both edges, so no zone moves the calendar day. */
function fromKey(key: string): Date {
  const [, year, month, day] = KEY.exec(key) ?? [];
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const date = fromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
}

/** Same day of the month, clamped: January 31 plus one month is February 28. */
export function addMonths(key: string, months: number): string {
  const date = fromKey(key);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return toKey(date);
}

/** 0 = Sunday, as the database numbers business hours. */
export function weekdayOf(key: string): number {
  return fromKey(key).getUTCDay();
}

/** The Monday on or before the day. */
export function startOfWeek(key: string): string {
  const weekday = weekdayOf(key);
  return addDays(key, weekday === 0 ? -6 : 1 - weekday);
}

export function monthOf(key: string): number {
  return fromKey(key).getUTCMonth();
}

export function dayOfMonth(key: string): number {
  return fromKey(key).getUTCDate();
}

/** The weeks a month grid needs, Monday first, padded with the neighboring days. */
export function monthGrid(key: string): string[][] {
  const first = `${key.slice(0, 7)}-01`;
  const start = startOfWeek(first);
  const month = monthOf(first);

  const weeks: string[][] = [];
  let cursor = start;
  do {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    cursor = addDays(cursor, 7);
  } while (monthOf(cursor) === month && weeks.length < 6);

  return weeks;
}

/* ---------------------------------------------------------- instants ↔ keys */

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGENDA_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** The day key and the minutes since midnight of an instant, in the clinic's zone. */
export function instantParts(iso: string): { key: string; minutes: number } {
  const parts = Object.fromEntries(
    PARTS.formatToParts(new Date(iso)).map((part) => [part.type, part.value]),
  );
  return {
    key: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function todayKey(now = new Date()): string {
  return instantParts(now.toISOString()).key;
}

/** Whole calendar days from one day key to another (`to - from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / 86_400_000);
}

/**
 * "Hoje", "Amanhã", "Ontem", "Em 3 dias", "Há 2 dias" — the day of an instant
 * next to today, in the clinic's zone. Past a week it is `null`: "em 23 dias"
 * locates nothing, and the date does.
 */
export function relativeDay(iso: string, now = new Date()): string | null {
  const diff = daysBetween(todayKey(now), instantParts(iso).key);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (Math.abs(diff) > 6) return null;
  return diff > 0 ? `Em ${diff} dias` : `Há ${-diff} dias`;
}

/**
 * The instant of a wall-clock time in the clinic's zone.
 *
 * Start from the time read as UTC and correct by however far the zone's own
 * reading of that instant is from what was asked for. One correction is enough
 * where the offset does not change within the day, and São Paulo has no daylight
 * saving time.
 */
export function zonedInstant(key: string, minutes: number): string {
  const [, year, month, day] = KEY.exec(key) ?? [];
  const asUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), 0, minutes);

  const seen = instantParts(new Date(asUtc).toISOString());
  const seenAsUtc = Date.UTC(
    Number(seen.key.slice(0, 4)),
    Number(seen.key.slice(5, 7)) - 1,
    Number(seen.key.slice(8, 10)),
    0,
    seen.minutes,
  );

  return new Date(asUtc - (seenAsUtc - asUtc)).toISOString();
}

export function dayStart(key: string): string {
  return zonedInstant(key, 0);
}

/* ------------------------------------------------------------------ ranges */

/** The days a view shows, from `from` (inclusive) to `to` (exclusive), as keys. */
export function visibleDays(view: AgendaView, key: string): { from: string; to: string } {
  if (view === AGENDA_VIEW.DAY) return { from: key, to: addDays(key, 1) };
  if (view === AGENDA_VIEW.WEEK) {
    const start = startOfWeek(key);
    return { from: start, to: addDays(start, 7) };
  }
  const weeks = monthGrid(key);
  const first = weeks[0]?.[0] ?? key;
  const last = weeks[weeks.length - 1]?.[6] ?? key;
  return { from: first, to: addDays(last, 1) };
}

export function stepView(view: AgendaView, key: string, direction: 1 | -1): string {
  if (view === AGENDA_VIEW.DAY) return addDays(key, direction);
  if (view === AGENDA_VIEW.WEEK) return addDays(key, 7 * direction);
  return addMonths(key, direction);
}

/* ------------------------------------------------------------------ labels */

function label(key: string, options: Intl.DateTimeFormatOptions): string {
  return fromKey(key).toLocaleDateString("pt-BR", { timeZone: "UTC", ...options });
}

export function weekdayShort(key: string): string {
  return label(key, { weekday: "short" }).replace(".", "");
}

export function dayTitle(key: string): string {
  return label(key, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function viewTitle(view: AgendaView, key: string): string {
  if (view === AGENDA_VIEW.DAY) return dayTitle(key);
  if (view === AGENDA_VIEW.MONTH) return label(key, { month: "long", year: "numeric" });

  const { from, to } = visibleDays(view, key);
  const last = addDays(to, -1);
  const sameMonth = monthOf(from) === monthOf(last);
  return sameMonth
    ? `${dayOfMonth(from)} a ${dayOfMonth(last)} de ${label(last, { month: "long", year: "numeric" })}`
    : `${label(from, { day: "numeric", month: "short" }).replace(".", "")} a ${label(last, { day: "numeric", month: "short", year: "numeric" }).replace(".", "")}`;
}

/* ------------------------------------------------------------- time strings */

export function minutesOfTime(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes ?? 0);
}

export function timeOfMinutes(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, minutes));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(clamped % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------ personal block */

export const BLOCK_LABEL_MAX = 80;

/**
 * Whether `[startsAt, endsAt)` touches a stretch when `professionalId` cannot take
 * appointments.
 *
 * Half-open on both sides, as the database counts it: a block that ends at 12:00
 * and an appointment that starts at 12:00 do not collide. This only lets the form
 * say "unavailable" before the database refuses — the database stays the judge,
 * and answers `slot_blocked` either way.
 */
export function overlapsBusy(
  intervals: { professional_id: string; starts_at: string; ends_at: string }[],
  professionalId: string | null,
  startsAt: string,
  endsAt: string,
): boolean {
  if (!professionalId) return false;

  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  return intervals.some(
    (interval) =>
      interval.professional_id === professionalId &&
      new Date(interval.starts_at).getTime() < end &&
      new Date(interval.ends_at).getTime() > start,
  );
}

/** The reason a block cannot be saved, or `null`. The database checks the period too. */
export function blockError(input: { label: string | null; starts_at: string; ends_at: string }): string | null {
  const start = new Date(input.starts_at).getTime();
  const end = new Date(input.ends_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return "Informe o início e o fim do bloqueio.";
  if (end <= start) return "O fim do bloqueio precisa ser depois do início.";
  if ((input.label?.trim().length ?? 0) > BLOCK_LABEL_MAX) {
    return `O motivo tem no máximo ${BLOCK_LABEL_MAX} caracteres.`;
  }
  return null;
}

/* ------------------------------------------------------------- day layout */

/**
 * The part of a stretch that falls on one day, as minutes since midnight, or
 * `null` when it does not touch the day. A block that runs over three days is
 * drawn as three pieces, each clipped to its day.
 */
export function segmentOnDay(
  key: string,
  startsAt: string,
  endsAt: string,
): { start: number; end: number } | null {
  // Compared as numbers: the database writes an instant as `…+00:00` and this
  // module as `….000Z`, and as text the two do not order the way they read.
  const dayFrom = Date.parse(dayStart(key));
  const dayTo = Date.parse(dayStart(addDays(key, 1)));

  const from = Math.max(Date.parse(startsAt), dayFrom);
  const to = Math.min(Date.parse(endsAt), dayTo);
  if (to <= from) return null;

  return {
    start: instantParts(new Date(from).toISOString()).minutes,
    end: to === dayTo ? 24 * 60 : instantParts(new Date(to).toISOString()).minutes,
  };
}

export interface PlacedItem<T> {
  item: T;
  start: number;
  end: number;
  /** Which lane of the overlapping group this one takes, from 0. */
  column: number;
  /** How many lanes the group needs; every item of a group shares the number. */
  columns: number;
}

/**
 * Puts items that overlap in time side by side instead of on top of each other.
 * Items that do not overlap anything keep the full width.
 */
export function placeOverlaps<T>(items: { item: T; start: number; end: number }[]): PlacedItem<T>[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const placed: PlacedItem<T>[] = [];

  let group: PlacedItem<T>[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;

  const closeGroup = () => {
    for (const entry of group) entry.columns = laneEnds.length;
    group = [];
    laneEnds = [];
  };

  for (const entry of sorted) {
    if (entry.start >= groupEnd) closeGroup();

    let lane = laneEnds.findIndex((end) => end <= entry.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = entry.end;

    const positioned: PlacedItem<T> = { ...entry, column: lane, columns: 1 };
    group.push(positioned);
    placed.push(positioned);
    groupEnd = Math.max(groupEnd, entry.end);
  }
  closeGroup();

  return placed;
}
