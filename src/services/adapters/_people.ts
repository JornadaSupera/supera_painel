import { digitsOnly, maskEmail } from "@/lib/mask";

/**
 * LISTING AND CONTACT RULES FOR PEOPLE, shared by both adapters.
 *
 * Search fields, default ordering and the way a document or a destination is
 * shown are decisions about the screen's answer, not about where the rows come
 * from — so the mock and Supabase take them from the same place.
 */

/** The prototype lists the team by name. */
export const USER_SEARCH_FIELDS = ["nome", "email", "registro"];
export const USER_DEFAULT_SORT = { field: "nome", direction: "asc" } as const;

/** The prototype lists patients from the most recent registration down. */
export const PATIENT_DEFAULT_SORT = { field: "criado_em", direction: "desc" } as const;

/**
 * Searching by document has to work with whatever the person types. A purely
 * numeric term ("123.456", "123 456") is reduced to its digits, so it matches
 * the stored document however it was punctuated.
 */
export function normalizePatientSearch(search?: string): string {
  const term = (search ?? "").trim();
  return /^[\d.\-\s/]+$/.test(term) && term.length > 0 ? digitsOnly(term) : term;
}

/** "juliana.fontana@cosc.com.br" → "ju•••••••@cosc.com.br" */
export function maskDestination(email: string): string {
  const [user, domain] = email.split("@");
  return user && domain ? maskEmail(email) : "seu contato cadastrado";
}
