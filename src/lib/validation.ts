import { isDayKey, todayKey } from "./agenda";
import { digitsOnly } from "./mask";

/**
 * Brazilian document and contact validation.
 *
 * It lives here instead of inside a zod schema because the same rule applies in
 * more than one domain — CPF in Patients, phone in Patients and Users — and
 * because a pure rule is testable without mounting a form.
 */

/**
 * CPF with its check digits verified.
 *
 * Rejects repeated sequences ("111.111.111-11"): they pass the check-digit
 * math, but none of them was ever issued. Without this check the field would
 * accept the most common input from someone trying to game the registration.
 */
export function isValidCpf(value: string | null | undefined): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (upTo: number): number => {
    let sum = 0;
    for (let i = 0; i < upTo; i += 1) {
      sum += Number(digits[i]) * (upTo + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10]);
}

/** Brazilian mobile or landline: 10 or 11 digits, area code between 11 and 99. */
export function isValidPhone(value: string | null | undefined): boolean {
  const digits = digitsOnly(value);
  if (digits.length !== 10 && digits.length !== 11) return false;

  const areaCode = Number(digits.slice(0, 2));
  if (areaCode < 11 || areaCode > 99) return false;

  // A mobile number has 11 digits and its ninth digit is always a 9.
  return digits.length === 10 || digits[2] === "9";
}

/*
 * Dates are compared as `YYYY-MM-DD` text, never as instants:
 * `new Date("2026-10-08")` is midnight UTC, which in Brasília is still 21h of
 * the 7th, so comparing clocks let tomorrow through every evening. And "today"
 * is the clinic's, not the browser's: it is how the database counts days, and
 * it refused on save what the form had let through.
 *
 * Only a real day passes. Text that is not one — "12/03/20", half-typed — is
 * invalid here, and never read by `new Date`, which takes it for 3 December
 * 2020.
 */

/** The `YYYY-MM-DD` part, when it is a real calendar day; `""` otherwise. */
function dayOf(iso: string | null | undefined): string {
  const day = iso?.slice(0, 10) ?? "";
  return isDayKey(day) ? day : "";
}

/** A calendar day after today, in the clinic's time zone. */
export function isFutureDate(iso: string | null | undefined): boolean {
  const day = dayOf(iso);
  return day !== "" && day > todayKey();
}

/** A date up to today, within a plausible range for a living person. */
export function isValidBirthDate(iso: string | null | undefined): boolean {
  const day = dayOf(iso);
  if (!day || isFutureDate(day)) return false;

  const today = todayKey();
  const oldest = `${Number(today.slice(0, 4)) - 120}${today.slice(4)}`;
  return day >= oldest;
}

/**
 * A date that has already happened — today counts.
 *
 * Used by the clinical record, where every date describes something that was
 * observed: a diagnosis and the start of a treatment plan are facts with a
 * past, and a future one is a typo — most often a wrong year.
 */
export function isValidPastDate(iso: string | null | undefined): boolean {
  const day = dayOf(iso);
  return day !== "" && !isFutureDate(day) && day >= "1900-01-01";
}

/** "12345678909" → "123.456.789-09", applied as the person types. */
export function applyCpfMask(value: string): string {
  const d = digitsOnly(value).slice(0, 11);

  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** "48991234521" → "(48) 99123-4521", applied as the person types. */
export function applyPhoneMask(value: string): string {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 2) return d;

  const areaCode = `(${d.slice(0, 2)})`;
  const rest = d.slice(2);

  if (rest.length <= 4) return `${areaCode} ${rest}`;
  if (rest.length <= 8) return `${areaCode} ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `${areaCode} ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
