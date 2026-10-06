/**
 * Date and time typed the Brazilian way, kept as ISO inside the forms.
 *
 * The browser draws a native date or time field in the language of the machine,
 * so the same screen showed mm/dd/yyyy and AM/PM on an English one. The fields
 * in the panel are text fields with a mask instead — dd/mm/aaaa and 24 hours —
 * and the forms keep their `YYYY-MM-DD` and `HH:mm` values, so no schema changes.
 */

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** `25102026` → `25/10/2026`, as the person types. */
export function maskDate(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** `2026-10-25` → `25/10/2026`. Anything else comes back empty. */
export function isoToBrDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

/** `25/10/2026` → `2026-10-25`; empty when incomplete or not a real day (31/02). */
export function brDateToIso(text: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return "";

  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const real =
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day);

  return real ? `${year}-${month}-${day}` : "";
}

/** `0930` → `09:30`, as the person types. */
export function maskTime(raw: string): string {
  const digits = digitsOnly(raw).slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** `09:30` is returned as is; empty when incomplete or out of range (25:00). */
export function brTimeToIso(text: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(text);
  if (!match) return "";
  return Number(match[1]) < 24 && Number(match[2]) < 60 ? `${match[1]}:${match[2]}` : "";
}
