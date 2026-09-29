import { okOne, type SingleResult } from "@/services/contracts";
import type { MatrizPermissoes } from "@/types/usuario";
import { buildPermissionMatrix } from "../_permissions";

/**
 * Matriz papel × permissão, somente leitura.
 *
 * > [!] A matriz por papel não é dado do backend.
 * O catálogo `permissions` do banco é outro eixo: restringe ações do espaço do
 * profissional e se concede pessoa a pessoa (`usuarios.grantPermission`). A
 * matriz por papel descreve a regra do painel — é a mesma fonte que
 * `lib/rbac.ts` usa para decidir o que `<Can>` mostra — e por isso só tem
 * leitura.
 */

export async function getMatrix(): Promise<SingleResult<MatrizPermissoes>> {
  return okOne(buildPermissionMatrix());
}
