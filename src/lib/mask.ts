/**
 * Personal data masking.
 *
 * PROJECT RULE: CPF, phone and e-mail are shown masked by default in every
 * listing. Revealing the full value is an explicit user action — and that
 * action is written to the audit trail.
 *
 * It reduces incidental exposure: the panel left open at a reception desk, a
 * screen shared in a meeting, a screenshot sent by mistake.
 *
 * This is presentation, not security. The full value should never reach the
 * browser of someone who may not see it — that is row level security in
 * Postgres.
 */

const EMPTY = "—";

type Value = string | null | undefined;

/**
 * "12345678909" → "•••.•••.789-09"
 *
 * Reference format: hides the first six digits and keeps the last five, the
 * convention used in Brazil for checking a document without exposing it whole.
 *
 * > [!] Note raised with the client
 * Keeping the last five digits is more permissive than also hiding the check
 * digits. On a small base, those digits narrow the search space for a CPF a
 * lot. We follow the reference screens because they are the visual source of
 * truth, but switching to `•••.•••.789-••` is a one-line change — and the call
 * belongs to the clinic's data protection officer.
 */
export function maskCpf(cpf: Value): string {
  const digits = digitsOnly(cpf);
  if (digits.length !== 11) return EMPTY;
  return `•••.•••.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/** "12345678909" → "123.456.789-09". Only under an explicit, audited action. */
export function formatCpf(cpf: Value): string {
  const digits = digitsOnly(cpf);
  if (digits.length !== 11) return EMPTY;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

/** "48991234521" → "(48) 9****-**21" */
export function maskPhone(phone: Value): string {
  const digits = digitsOnly(phone);
  if (digits.length < 10) return EMPTY;

  const areaCode = digits.slice(0, 2);
  const lastTwo = digits.slice(-2);
  const ninthDigit = digits.length === 11 ? "9" : "";

  return `(${areaCode}) ${ninthDigit}****-**${lastTwo}`;
}

/** "48991234521" → "(48) 99123-4521" */
export function formatPhone(phone: Value): string {
  const digits = digitsOnly(phone);
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return EMPTY;
}

/** "maria.souza@clinica.com.br" → "ma••••••@clinica.com.br" */
export function maskEmail(email: Value): string {
  const [user, domain] = (email ?? "").split("@");
  if (!user || !domain) return EMPTY;

  return `${user.slice(0, 2)}${"•".repeat(Math.max(3, user.length - 2))}@${domain}`;
}

/**
 * "203.0.113.42" → "203.0.113.***"
 * Used on the audit screen when the log is shown to someone without data
 * protection officer clearance.
 */
export function maskIp(ip: Value): string {
  const parts = (ip ?? "").split(".");
  if (parts.length !== 4) return EMPTY;
  return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
}

/** Digits only — what goes to the backend. */
export function digitsOnly(value: Value): string {
  return (value ?? "").replace(/\D/g, "");
}
