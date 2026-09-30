import { PAPEL } from "@/lib/enums";
import { PERMISSAO, type Permissao } from "@/lib/rbac";
import { catalogoPermissoes, concedidas, PAPEIS } from "@/lib/permission-catalog";
import type { MatrizPermissoes } from "@/types/usuario";

/**
 * ROLE × PERMISSION MATRIX, as the adapter exposes it.
 *
 * It comes from `lib/permission-catalog`, which derives from `lib/rbac.ts`: the
 * same source that decides what `<Can>` shows.
 */

/**
 * Specialty-exclusive permissions never go into a role. Psychology secrecy
 * belongs to the specialty; granting it through a role would give the
 * administrator access to session content.
 */
const SPECIALTY_EXCLUSIVE_PERMISSIONS: Permissao[] = [PERMISSAO.SIGILO_PSICOLOGIA];

/** A snapshot of the matrix: copies, so the screen never mutates the source. */
export function buildPermissionMatrix(): MatrizPermissoes {
  return {
    papeis: PAPEIS,
    permissoes: catalogoPermissoes,
    concedidas: {
      [PAPEL.ADMIN]: [...concedidas[PAPEL.ADMIN]],
      [PAPEL.PROFISSIONAL]: [...concedidas[PAPEL.PROFISSIONAL]],
    },
    exclusivas_de_especialidade: SPECIALTY_EXCLUSIVE_PERMISSIONS,
  };
}
