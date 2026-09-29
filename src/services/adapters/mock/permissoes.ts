import { okOne, type SingleResult } from "@/services/contracts";
import type { MatrizPermissoes } from "@/types/usuario";
import { buildPermissionMatrix } from "../_permissions";
import { simulate } from "./_helpers";

/**
 * Matriz papel × permissão, somente leitura.
 *
 * É a regra em vigor do painel, a mesma que `lib/rbac.ts` usa para decidir o
 * que `<Can>` mostra. Não há escrita: o adapter real não teria onde gravá-la, e
 * o mock não promete o que o backend não faz.
 */

export async function getMatrix(): Promise<SingleResult<MatrizPermissoes>> {
  return simulate(() => okOne(buildPermissionMatrix()));
}
