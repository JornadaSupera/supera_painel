import { PAPEL, type Papel } from "@/lib/enums";
import { PERMISSAO, type Permissao } from "@/lib/rbac";
import { concedidas, PAPEIS } from "@/mocks/permissoes";
import { ERROR_CODE, fail, okOne, type SingleResult } from "@/services/contracts";
import type { MatrizPermissoes } from "@/types/usuario";
import { SPECIALTY_EXCLUSIVE_PERMISSIONS, buildPermissionMatrix } from "../_permissions";
import { simulate } from "./_helpers";

/**
 * Matriz papel × permissão.
 *
 * > [!] Duas regras que a tela não pode relaxar, e por isso são checadas aqui.
 * 1. O administrador não perde `usuarios:manage` nem `permissoes:manage` — sem
 *    elas, ninguém consegue reverter a própria alteração e o painel fica sem
 *    quem administre.
 * 2. Permissão exclusiva de especialidade não entra em papel nenhum. Ver
 *    `SPECIALTY_EXCLUSIVE_PERMISSIONS`.
 */

/** Sem estas, o administrador não consegue desfazer o que acabou de fazer. */
const INDISPENSAVEIS_DO_ADMIN: Permissao[] = [
  PERMISSAO.USUARIOS_MANAGE,
  PERMISSAO.PERMISSOES_MANAGE,
];

export async function getMatrix(): Promise<SingleResult<MatrizPermissoes>> {
  return simulate(() => okOne(buildPermissionMatrix()));
}

export async function updateMatrix({
  concedidas: novas,
}: {
  concedidas: Record<Papel, Permissao[]>;
}): Promise<SingleResult<MatrizPermissoes>> {
  return simulate(() => {
    const doAdmin = novas[PAPEL.ADMIN] ?? [];

    const faltando = INDISPENSAVEIS_DO_ADMIN.filter((permissao) => !doAdmin.includes(permissao));
    if (faltando.length > 0) {
      return fail(
        ERROR_CODE.VALIDATION,
        "O administrador precisa manter a gestão de usuários e de permissões.",
      );
    }

    for (const papel of PAPEIS) {
      const limpa = (novas[papel] ?? []).filter(
        (permissao) => !SPECIALTY_EXCLUSIVE_PERMISSIONS.includes(permissao),
      );

      // Mantém a referência do objeto do mock: outros módulos já a importaram.
      concedidas[papel].length = 0;
      concedidas[papel].push(...limpa);
    }

    return okOne(buildPermissionMatrix());
  });
}
