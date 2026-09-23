/**
 * pt-BR formatting.
 *
 * The data layer works in ISO 8601 UTC and raw numbers. Converting to the
 * Brazilian format happens at render time only — never in the mock, never in
 * the adapter. That keeps sorting, filtering and exporting correct.
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
 */
export function relativeTime(iso: IsoDate): string {
  if (!iso) return EMPTY;

  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return "agora há pouco";

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

/** "12,4%" */
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return EMPTY;
  return `${value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** "7 min", "1 h 12 min" */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return EMPTY;

  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;

  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
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
