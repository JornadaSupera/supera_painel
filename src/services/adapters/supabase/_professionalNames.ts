import { umDe } from "./_helpers";
import type { getSupabaseClient } from "./client";

/**
 * Professionals' names, for screens that show who did something.
 *
 * The name lives on the account, one join away from the professional. Both the
 * patient record (who wrote a note) and the conversation history (who held it)
 * need the same lookup, and a name that reads differently in two places would
 * look like two different people.
 */

export const NO_NAME = "Profissional";

export interface ProfessionalNameRow {
  id: string;
  accounts: { full_name: string | null } | { full_name: string | null }[] | null;
}

export function professionalNamesQuery(supabase: ReturnType<typeof getSupabaseClient>, ids: string[]) {
  return supabase.from("professionals").select("id, accounts ( full_name )").in("id", ids);
}

export function namesById(rows: ProfessionalNameRow[] | null): Map<string, string> {
  return new Map(
    (rows ?? []).map((row) => [row.id, umDe(row.accounts)?.full_name?.trim() || NO_NAME]),
  );
}
