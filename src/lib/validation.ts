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

/** A past date, within a plausible range for a living person. */
export function isValidBirthDate(iso: string | null | undefined): boolean {
  if (!iso) return false;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  const limit = new Date();
  limit.setFullYear(today.getFullYear() - 120);

  return date <= today && date >= limit;
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
