import { PAPEL, type Papel } from "@/lib/enums";
import { PERMISSAO_LABEL, PERMISSOES_POR_PAPEL, type Permissao } from "./rbac";

/**
 * Matriz papel × permissão — o RBAC em vigor, somente leitura.
 *
 * Deriva de `lib/rbac.ts`, que é a regra vigente em código. A matriz por papel não é editável em lugar nenhum: o que se
 * concede a uma pessoa em particular é outro eixo, e vive na ficha dela.
 */

/** Agrupamento apenas de apresentação — vira as seções da tabela na tela. */
const GRUPOS: { titulo: string; prefixos: string[] }[] = [
  { titulo: "Painel", prefixos: ["dashboard:"] },
  { titulo: "Pacientes", prefixos: ["pacientes:"] },
  { titulo: "Usuários e acesso", prefixos: ["usuarios:", "permissoes:"] },
  { titulo: "Conteúdo", prefixos: ["conteudo:"] },
  { titulo: "Relatórios", prefixos: ["relatorios:"] },
  { titulo: "Satisfação", prefixos: ["satisfacao:"] },
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

export const PAPEIS: Papel[] = [PAPEL.ADMIN, PAPEL.PROFISSIONAL];

/** O que cada papel concede, tirado de `lib/rbac.ts`. */
export const concedidas: Record<Papel, Permissao[]> = {
  [PAPEL.ADMIN]: [...PERMISSOES_POR_PAPEL[PAPEL.ADMIN]],
  [PAPEL.PROFISSIONAL]: [...PERMISSOES_POR_PAPEL[PAPEL.PROFISSIONAL]],
};

export default concedidas;
