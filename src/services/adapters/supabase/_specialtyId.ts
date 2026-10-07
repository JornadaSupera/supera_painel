import type { Especialidade } from "@/lib/enums";
import { ERROR_CODE, fail, type FailResult } from "@/services/contracts";
import { falhaDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraCodigoDeEspecialidade } from "./mapping";

/**
 * The database id of one of the panel's specialties: what a write that names
 * its area of origin sends. A missing area comes back as a failure the screen
 * can show, not as a write the database refuses for a reason nobody reads.
 */
export async function specialtyIdOf(specialty: Especialidade): Promise<{ id: string } | FailResult> {
  const { data, error } = await getSupabaseClient()
    .from("specialties")
    .select("id")
    .eq("code", paraCodigoDeEspecialidade(specialty))
    .maybeSingle();
  if (error) return falhaDe(error);
  if (!data) return fail(ERROR_CODE.NOT_FOUND, "Especialidade não encontrada.");
  return { id: (data as { id: string }).id };
}
