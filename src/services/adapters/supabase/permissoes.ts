import { PAPEL } from "@/lib/enums";
import { PERMISSAO, type Permissao } from "@/lib/rbac";
import { catalogoPermissoes, concedidas, PAPEIS } from "@/mocks/permissoes";
import { ERROR_CODE, fail, okOne, type SingleResult } from "@/services/contracts";
import type { MatrizPermissoes } from "@/types/usuario";

/**
 * Matriz papel × permissão.
 *
 * > [!] A matriz ainda não é dado do backend.
 * O catálogo `permissions` do banco está vazio e nada concede permissão
 * individual: hoje todo profissional ativo tem o mesmo alcance, e a diferença
 * real entre perfis é a que as políticas de RLS impõem — quem é admin, quem é
 * profissional, e de qual especialidade.
 *
 * A tela continua exibindo a matriz porque ela **descreve a regra em vigor**:
 * é a mesma fonte que `lib/rbac.ts` usa para decidir o que `<Can>` mostra. O
 * que muda em relação ao mock é que aqui ela é somente leitura — editar daria
 * a impressão de alterar um controle de acesso que, do lado do banco, não
 * mudaria nada.
 *
 * Quando `permissions` virar dado, `getMatrix` passa a lê-lo e `updateMatrix`
 * ganha a RPC correspondente. Nenhuma tela muda junto.
 */

const EXCLUSIVAS_DE_ESPECIALIDADE: Permissao[] = [PERMISSAO.SIGILO_PSICOLOGIA];

export async function getMatrix(): Promise<SingleResult<MatrizPermissoes>> {
  return okOne<MatrizPermissoes>({
    papeis: PAPEIS,
    permissoes: catalogoPermissoes,
    concedidas: {
      [PAPEL.ADMIN]: [...concedidas[PAPEL.ADMIN]],
      [PAPEL.GESTOR]: [...concedidas[PAPEL.GESTOR]],
      [PAPEL.PROFISSIONAL]: [...concedidas[PAPEL.PROFISSIONAL]],
    },
    exclusivas_de_especialidade: EXCLUSIVAS_DE_ESPECIALIDADE,
  });
}

export async function updateMatrix(): Promise<SingleResult<MatrizPermissoes>> {
  return fail(
    ERROR_CODE.NOT_IMPLEMENTED,
    "A matriz de permissões ainda não é dado do backend: alterá-la aqui não mudaria o acesso de ninguém.",
  );
}
