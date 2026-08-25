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

/** "25/08/2026" */
export function formatDate(iso: IsoDate): string {
  if (!iso) return EMPTY;
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

/** "25 de agosto de 2026" */
export function formatLongDate(iso: IsoDate): string {
  if (!iso) return EMPTY;
  return new Date(iso).toLocaleDateString(LOCALE, {
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

  const birthDate = new Date(isoBirthDate);
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
