/**
 * pt-BR formatting.
 *
 * The data layer works in ISO 8601 UTC and raw numbers. Converting to the
 * Brazilian format happens at render time only — never in the
 * adapter. That keeps sorting, filtering and exporting correct.
 */

const LOCALE = "pt-BR";
const TIME_ZONE = "America/Sao_Paulo";
const EMPTY = "—";

type IsoDate = string | null | undefined;

/* ------------------------------------------------------------------- dates */

/**
 * A date with no time at all — `2026-09-04`, the shape a Postgres `date` takes.
 *
 * It matters because such a value is a CALENDAR date, not an instant: a birth
 * date, the day a diagnosis was issued, the day a treatment began. Nothing
 * about it happened at a time of day.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "25/08/2026"
 *
 * > [!] A date-only value is NOT converted between time zones.
 * `new Date("2026-09-04")` is parsed as midnight UTC, and rendering that in
 * São Paulo lands on the evening of the 3rd — so the panel displayed every
 * `date` column one day early. A patient born on the 10th read as the 9th, and
 * a treatment that began on the 4th read as the 3rd.
 *
 * Shifting is correct for an instant, which is why the fall-through keeps it:
 * an audit entry stamped at 02:00 UTC did happen on the previous evening here.
 * A calendar date has no instant to shift, so it is split and reassembled.
 */
export function formatDate(iso: IsoDate): string {
  if (!iso) return EMPTY;

  if (DATE_ONLY.test(iso)) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }

  return new Date(iso).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE });
}

/** "25/08/2026 14:32" */
export function formatDateTime(iso: IsoDate): string {
  if (!iso) return EMPTY;
  return new Date(iso).toLocaleString(LOCALE, {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "14:32" */
export function formatTime(iso: IsoDate): string {
  if (!iso) return EMPTY;
  return new Date(iso).toLocaleTimeString(LOCALE, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "25 de agosto de 2026". Mesma regra de `formatDate` para data sem hora. */
export function formatLongDate(iso: IsoDate): string {
  if (!iso) return EMPTY;

  // Meio-dia UTC: longe o bastante das duas bordas para que nenhum fuso mova o
  // dia, e é só o dia que este formato usa.
  const instante = DATE_ONLY.test(iso) ? new Date(`${iso}T12:00:00Z`) : new Date(iso);

  return instante.toLocaleDateString(LOCALE, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * "há 5 min", "há 2 h", "ontem" — as on the audit reference screen.
 *
 * Past seven days it falls back to the absolute date: "há 43 dias" helps
 * nobody locate an event.
 *
 * It describes something that already happened, so a timestamp a few minutes
 * AHEAD of this machine's clock is read as "just now", not "em 4 minutos": the
 * server stamps the event, and a computer whose clock runs behind would
 * otherwise announce it in the future. Pass `future: true` for what is truly
 * yet to come (the next run of a schedule).
 */
const CLOCK_SKEW_TOLERANCE_SECONDS = 600;

export function relativeTime(iso: IsoDate, options: { future?: boolean } = {}): string {
  if (!iso) return EMPTY;

  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return "agora há pouco";
  if (!options.future && seconds > 0 && seconds <= CLOCK_SKEW_TOLERANCE_SECONDS) {
    return "agora há pouco";
  }

  const rtf = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });

  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 604800) return rtf.format(Math.round(seconds / 86400), "day");

  return formatDate(iso);
}

/** Age in years from the birth date. */
export function ageInYears(isoBirthDate: IsoDate): number | null {
  if (!isoBirthDate) return null;

  /*
   * Meio-dia, pela mesma razão de `formatLongDate`: `new Date("1999-10-10")`
   * é meia-noite UTC, e `getDate()` no fuso local devolve 9. Quem faz
   * aniversário hoje aparecia com um ano a menos.
   */
  const birthDate = DATE_ONLY.test(isoBirthDate)
    ? new Date(`${isoBirthDate}T12:00:00Z`)
    : new Date(isoBirthDate);
  const today = new Date();

  let years = today.getFullYear() - birthDate.getFullYear();
  const months = today.getMonth() - birthDate.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) years -= 1;

  return years;
}

/* ----------------------------------------------------------------- numbers */

/** "1.234" */
export function formatNumber(
  value: number | null | undefined,
  options?: Intl.NumberFormatOptions,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return value.toLocaleString(LOCALE, options);
}

/** "1 paciente" / "2 pacientes" — pt-BR treats only exactly 1 as singular. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** "12,4%" */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/**
 * "7 min", "1 h 12 min", "14 d 21 h"
 *
 * From one day up the minutes are dropped: "14 d 21 h 18 min" is precision the
 * measure does not have, and it is what made "21.438min" unreadable.
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return EMPTY;

  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;

  if (total >= 1440) {
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    return hours === 0 ? `${days} d` : `${days} d ${hours} h`;
  }

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * A measure ready for a `StatCard`: the value and, when it still needs one, the
 * unit glued to it.
 *
 * Minutes are turned into a duration ("14 d 21 h") and carry no unit, because
 * the duration already says it. Any other unit goes through unchanged.
 */
export function formatMeasure(
  value: number | null,
  unit: string | undefined,
): { value: string; unit: string | undefined } {
  // No base to calculate from: a dash, and no unit glued to nothing.
  if (value === null) return { value: EMPTY, unit: undefined };
  if (unit === "min") return { value: formatDuration(value), unit: undefined };
  return { value: formatNumber(value), unit };
}

/**
 * The change of a measure read the same way as the measure itself: a change in
 * minutes is a duration ("-19 d 14 h"), not "-28.207". Other units return
 * `undefined`, and the card formats the number as it always did.
 */
export function formatMeasureDelta(
  delta: number | undefined,
  unit: string | undefined,
): string | undefined {
  if (unit !== "min" || delta === undefined || !Number.isFinite(delta)) return undefined;

  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${formatDuration(Math.abs(delta))}`;
}

/* -------------------------------------------------------------------- text */

/**
 * Initials from a name — first and last, skipping Portuguese particles.
 * "Maria das Graças Silva" → "MS"
 */
export function initials(name = ""): string {
  const particles = new Set(["de", "da", "do", "das", "dos", "e"]);
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part && !particles.has(part.toLowerCase()));

  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();

  const last = parts[parts.length - 1] ?? first;
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

/** Truncates on a whole word. */
export function truncate(text: string | null | undefined, limit = 80): string {
  const value = text ?? "";
  if (value.length <= limit) return value;

  const cut = value.lastIndexOf(" ", limit);
  return `${value.slice(0, cut > 0 ? cut : limit)}…`;
}

/* ------------------------------------------------------------------ parse */

/**
 * Reads a number written the way `formatNumber` writes it ("1.234", "4,7").
 * Anything else — a dash, a duration — comes back `null`, so a caller animating
 * a value never touches text it cannot rebuild.
 */
export function parseFormattedNumber(text: string): { value: number; decimals: number } | null {
  const match = /^(-?\d{1,3}(?:\.\d{3})+|-?\d+)(?:,(\d+))?$/.exec(text.trim());
  if (!match) return null;

  const [, integer = "", fraction] = match;
  return {
    value: Number(`${integer.replace(/\./g, "")}${fraction ? `.${fraction}` : ""}`),
    decimals: fraction?.length ?? 0,
  };
}
