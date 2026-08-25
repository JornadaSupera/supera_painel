import { PAPEL, type Papel } from "@/lib/enums";
import { PERMISSAO_LABEL, PERMISSOES_POR_PAPEL, type Permissao } from "@/lib/rbac";

/**
 * Matriz papel × permissão — o estado editável do RBAC.
 *
 * Semeada a partir de `lib/rbac.ts`, que é a regra vigente em código. Quando o
 * Supabase entrar, esta tabela passa a ser a fonte e `lib/rbac.ts` fica só com
 * o avaliador — a resolução (papel → especialidade → extras) continua sendo
 * dele, para que exista uma implementação só.
 *
 * A edição vive em memória: alterar a matriz aqui muda o painel até recarregar.
 * É o suficiente para validar a tela sem fingir uma persistência que não há.
 */

/** Agrupamento apenas de apresentação — vira as seções da tabela na tela. */
const GRUPOS: { titulo: string; prefixos: string[] }[] = [
  { titulo: "Painel", prefixos: ["dashboard:"] },
  { titulo: "Pacientes", prefixos: ["pacientes:"] },
  { titulo: "Usuários e acesso", prefixos: ["usuarios:", "permissoes:"] },
  { titulo: "Conteúdo", prefixos: ["conteudo:"] },
  { titulo: "Relatórios", prefixos: ["relatorios:"] },
  { titulo: "Estatísticas", prefixos: ["estatisticas:"] },
  { titulo: "Auditoria", prefixos: ["auditoria:"] },
  { titulo: "Configurações", prefixos: ["configuracoes:"] },
  { titulo: "Sigilo profissional", prefixos: ["sigilo:"] },
];

function grupoDe(permissao: Permissao): string {
  return (
    GRUPOS.find((grupo) => grupo.prefixos.some((prefixo) => permissao.startsWith(prefixo)))?.titulo ??
    "Outros"
  );
}

export const catalogoPermissoes = (Object.keys(PERMISSAO_LABEL) as Permissao[]).map((id) => ({
  id,
  label: PERMISSAO_LABEL[id],
  grupo: grupoDe(id),
}));

export const PAPEIS: Papel[] = [PAPEL.ADMIN, PAPEL.GESTOR, PAPEL.PROFISSIONAL];

/** Estado mutável da matriz. Começa igual ao que `lib/rbac.ts` define. */
export const concedidas: Record<Papel, Permissao[]> = {
  [PAPEL.ADMIN]: [...PERMISSOES_POR_PAPEL[PAPEL.ADMIN]],
  [PAPEL.GESTOR]: [...PERMISSOES_POR_PAPEL[PAPEL.GESTOR]],
  [PAPEL.PROFISSIONAL]: [...PERMISSOES_POR_PAPEL[PAPEL.PROFISSIONAL]],
};

export default concedidas;
