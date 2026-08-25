import { buildAdapter } from "../_stub";

/**
 * ADAPTER SUPABASE — esqueleto da Fase 15.
 *
 * Existe desde a Fase 0 de propósito: é o checklist vivo do que o backend
 * precisa entregar. Toda operação responde NOT_IMPLEMENTED até ser escrita,
 * com a MESMA assinatura do mock.
 *
 * Modelo de implementação (a tela não muda uma linha):
 *
 *   // ./pacientes.ts
 *   export async function list(params: ListParams): Promise<ListResult<Paciente>> {
 *     const { from, to, sort, filters, search } = normalizeListParams(params);
 *     let q = getSupabaseClient().from("pacientes").select("*", { count: "exact" });
 *     if (search) q = q.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%`);
 *     for (const [campo, valor] of Object.entries(filters)) {
 *       if (valor) q = Array.isArray(valor) ? q.in(campo, valor) : q.eq(campo, valor);
 *     }
 *     if (sort) q = q.order(sort.field, { ascending: sort.direction === "asc" });
 *     const { data, count, error } = await q.range(from, to);
 *     return error ? fail(mapSupabaseError(error), error.message) : ok(data ?? [], count ?? 0);
 *   }
 */

/** Preenchido na Fase 15, um recurso por vez. */
const implemented = {};

export const supabaseAdapter = buildAdapter({ name: "supabase", implemented });

export default supabaseAdapter;
