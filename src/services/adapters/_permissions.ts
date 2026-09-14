import { PAPEL } from "@/lib/enums";
import { PERMISSAO, type Permissao } from "@/lib/rbac";
import { catalogoPermissoes, concedidas, PAPEIS } from "@/mocks/permissoes";
import type { MatrizPermissoes } from "@/types/usuario";

/**
 * ROLE × PERMISSION MATRIX, as both adapters expose it.
 *
 * `mocks/permissoes` is imported here on purpose, and by the Supabase adapter
 * too: it is the RBAC matrix in force — the same source `lib/rbac.ts` uses to
 * decide what `<Can>` shows — not fictional data.
 */

/**
 * Specialty-exclusive permissions never go into a role. Psychology secrecy
 * belongs to the specialty; granting it through a role would give the
 * administrator access to session content.
 */
export const SPECIALTY_EXCLUSIVE_PERMISSIONS: Permissao[] = [PERMISSAO.SIGILO_PSICOLOGIA];

/** A snapshot of the matrix: copies, so the screen never mutates the source. */
export function buildPermissionMatrix(): MatrizPermissoes {
  return {
    papeis: PAPEIS,
    permissoes: catalogoPermissoes,
    concedidas: {
      [PAPEL.ADMIN]: [...concedidas[PAPEL.ADMIN]],
      [PAPEL.GESTOR]: [...concedidas[PAPEL.GESTOR]],
      [PAPEL.PROFISSIONAL]: [...concedidas[PAPEL.PROFISSIONAL]],
    },
    exclusivas_de_especialidade: SPECIALTY_EXCLUSIVE_PERMISSIONS,
  };
}
