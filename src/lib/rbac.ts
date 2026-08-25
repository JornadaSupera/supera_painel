import { ESPECIALIDADE, PAPEL, type Especialidade, type Papel } from "./enums";

/**
 * CONTROLE DE ACESSO BASEADO EM PAPEL (RBAC)
 * =============================================================================
 * Fonte única de verdade sobre quem pode o quê. Nenhuma tela decide permissão
 * por conta própria — todas perguntam aqui.
 *
 * > [!] Isto é conveniência de interface, não a barreira de segurança.
 * A barreira real é a **Row Level Security** no Postgres (Fase 15). Esconder um
 * botão impede o erro honesto; não impede quem abre o DevTools. As duas coisas
 * precisam existir, e precisam concordar.
 *
 * Requisito de origem: "perfis e permissões com isolamento de acesso".
 */

/* -------------------------------------------------------------------------
   PERMISSÕES
   Formato `recurso:ação[:escopo]`. O escopo distingue "os meus" de "todos".
   ------------------------------------------------------------------------- */

export const PERMISSAO = {
  DASHBOARD_READ: "dashboard:read",

  PACIENTES_READ: "pacientes:read",
  PACIENTES_WRITE: "pacientes:write",
  PACIENTES_DEACTIVATE: "pacientes:deactivate",
  PACIENTES_EXPORT: "pacientes:export",
  /** Revelar CPF, telefone ou e-mail completos. Cada uso gera log. */
  PACIENTES_REVEAL_PII: "pacientes:reveal_pii",

  USUARIOS_READ: "usuarios:read",
  USUARIOS_MANAGE: "usuarios:manage",
  /** Editar a matriz papel × permissão. Só administrador. */
  PERMISSOES_MANAGE: "permissoes:manage",

  CONTEUDO_READ: "conteudo:read",
  CONTEUDO_WRITE: "conteudo:write",
  CONTEUDO_PUBLISH: "conteudo:publish",
  /** Fila de aprovação (nível Médio). */
  CONTEUDO_APPROVE: "conteudo:approve",

  RELATORIOS_READ: "relatorios:read",
  RELATORIOS_EXPORT: "relatorios:export",
  RELATORIOS_SCHEDULE: "relatorios:schedule",

  ESTATISTICAS_CLINICAS_READ: "estatisticas:clinicas:read",
  /** Indicadores de todos os profissionais, nominais. */
  ESTATISTICAS_READ_ALL: "estatisticas:read:all",
  /** Apenas os próprios indicadores. */
  ESTATISTICAS_READ_SELF: "estatisticas:read:self",

  AUDITORIA_READ: "auditoria:read",
  /** Exportação CSV/JSON para relatório do DPO. */
  AUDITORIA_EXPORT: "auditoria:export",

  CONFIGURACOES_READ: "configuracoes:read",
  CONFIGURACOES_WRITE: "configuracoes:write",

  /** Conteúdo de Psicologia. Sigilo profissional — nunca herdado por papel. */
  SIGILO_PSICOLOGIA: "sigilo:psicologia",
} as const;

export type Permissao = (typeof PERMISSAO)[keyof typeof PERMISSAO];

/* -------------------------------------------------------------------------
   MATRIZ PAPEL → PERMISSÕES
   ------------------------------------------------------------------------- */

const TODAS_PERMISSOES = Object.values(PERMISSAO);

/**
 * Gestor: opera a clínica, mas não mexe na estrutura de acesso nem revela PII
 * em massa. Sem `PERMISSOES_MANAGE` e sem `AUDITORIA_EXPORT` — exportar a
 * trilha de auditoria é atribuição de DPO/administrador.
 */
const PERMISSOES_GESTOR: Permissao[] = [
  PERMISSAO.DASHBOARD_READ,
  PERMISSAO.PACIENTES_READ,
  PERMISSAO.PACIENTES_WRITE,
  PERMISSAO.PACIENTES_EXPORT,
  PERMISSAO.USUARIOS_READ,
  PERMISSAO.CONTEUDO_READ,
  PERMISSAO.CONTEUDO_WRITE,
  PERMISSAO.CONTEUDO_PUBLISH,
  PERMISSAO.CONTEUDO_APPROVE,
  PERMISSAO.RELATORIOS_READ,
  PERMISSAO.RELATORIOS_EXPORT,
  PERMISSAO.RELATORIOS_SCHEDULE,
  PERMISSAO.ESTATISTICAS_CLINICAS_READ,
  PERMISSAO.ESTATISTICAS_READ_ALL,
  PERMISSAO.AUDITORIA_READ,
  PERMISSAO.CONFIGURACOES_READ,
];

/**
 * Profissional clínico: consulta e produz conteúdo, vê só os próprios
 * indicadores. Não gerencia usuários nem configurações da clínica.
 */
const PERMISSOES_PROFISSIONAL: Permissao[] = [
  PERMISSAO.DASHBOARD_READ,
  PERMISSAO.PACIENTES_READ,
  PERMISSAO.CONTEUDO_READ,
  PERMISSAO.CONTEUDO_WRITE,
  PERMISSAO.RELATORIOS_READ,
  PERMISSAO.ESTATISTICAS_READ_SELF,
];

export const PERMISSOES_POR_PAPEL: Record<Papel, readonly Permissao[]> = {
  [PAPEL.ADMIN]: TODAS_PERMISSOES,
  [PAPEL.GESTOR]: PERMISSOES_GESTOR,
  [PAPEL.PROFISSIONAL]: PERMISSOES_PROFISSIONAL,
};

/**
 * Permissões que dependem da ESPECIALIDADE, não do papel.
 *
 * O sigilo de Psicologia não é herdável: nem administrador o recebe por ser
 * administrador. O PDF (§3, Psicólogo) é explícito — "conteúdo das sessões
 * restrito à Psicologia". Gestão de acesso é uma coisa; leitura de conteúdo
 * clínico sigiloso é outra.
 */
export const PERMISSOES_POR_ESPECIALIDADE: Partial<Record<Especialidade, readonly Permissao[]>> = {
  [ESPECIALIDADE.PSICOLOGO]: [PERMISSAO.SIGILO_PSICOLOGIA],
};

/** Permissões que nenhum papel concede sozinho — só a especialidade. */
const EXCLUSIVAS_DE_ESPECIALIDADE = new Set<Permissao>([PERMISSAO.SIGILO_PSICOLOGIA]);

/* -------------------------------------------------------------------------
   RESOLUÇÃO
   ------------------------------------------------------------------------- */

export interface PerfilAcesso {
  papel: Papel;
  especialidade?: Especialidade | null;
  /** Permissões concedidas individualmente na tela de Usuários (Fase 6). */
  permissoesExtras?: readonly Permissao[];
}

/**
 * Conjunto efetivo de permissões de um perfil.
 *
 * Ordem: papel → especialidade → extras individuais. Permissões exclusivas de
 * especialidade são removidas do que veio do papel, antes de somar as da
 * especialidade — é o que impede o administrador de herdar o sigilo.
 */
export function resolverPermissoes(perfil: PerfilAcesso): Set<Permissao> {
  const doPapel = PERMISSOES_POR_PAPEL[perfil.papel] ?? [];
  const efetivas = new Set(doPapel.filter((p) => !EXCLUSIVAS_DE_ESPECIALIDADE.has(p)));

  if (perfil.especialidade) {
    for (const permissao of PERMISSOES_POR_ESPECIALIDADE[perfil.especialidade] ?? []) {
      efetivas.add(permissao);
    }
  }

  for (const permissao of perfil.permissoesExtras ?? []) {
    efetivas.add(permissao);
  }

  return efetivas;
}

/** `can(permissoes, "pacientes:write")` — aceita uma ou várias (E lógico). */
export function can(
  permissoes: ReadonlySet<Permissao> | undefined,
  requeridas: Permissao | readonly Permissao[],
): boolean {
  if (!permissoes) return false;

  const lista = Array.isArray(requeridas) ? requeridas : [requeridas as Permissao];
  return lista.every((permissao) => permissoes.has(permissao));
}

/** Verdadeiro se tiver ao menos uma das permissões (OU lógico). */
export function canAny(
  permissoes: ReadonlySet<Permissao> | undefined,
  requeridas: readonly Permissao[],
): boolean {
  if (!permissoes) return false;
  return requeridas.some((permissao) => permissoes.has(permissao));
}

/* -------------------------------------------------------------------------
   RÓTULOS — usados na matriz de permissões da Fase 6
   ------------------------------------------------------------------------- */

export const PERMISSAO_LABEL: Record<Permissao, string> = {
  "dashboard:read": "Ver dashboard",
  "pacientes:read": "Ver pacientes",
  "pacientes:write": "Cadastrar e editar pacientes",
  "pacientes:deactivate": "Desativar pacientes",
  "pacientes:export": "Exportar lista de pacientes",
  "pacientes:reveal_pii": "Revelar dados pessoais completos",
  "usuarios:read": "Ver profissionais",
  "usuarios:manage": "Gerenciar profissionais",
  "permissoes:manage": "Editar permissões",
  "conteudo:read": "Ver conteúdos",
  "conteudo:write": "Criar e editar conteúdos",
  "conteudo:publish": "Publicar conteúdos",
  "conteudo:approve": "Aprovar conteúdos",
  "relatorios:read": "Ver relatórios",
  "relatorios:export": "Exportar relatórios",
  "relatorios:schedule": "Agendar envio de relatórios",
  "estatisticas:clinicas:read": "Ver estatísticas clínicas",
  "estatisticas:read:all": "Ver indicadores de todos os profissionais",
  "estatisticas:read:self": "Ver os próprios indicadores",
  "auditoria:read": "Ver trilha de auditoria",
  "auditoria:export": "Exportar auditoria (DPO)",
  "configuracoes:read": "Ver configurações",
  "configuracoes:write": "Editar configurações",
  "sigilo:psicologia": "Acessar conteúdo sigiloso de Psicologia",
};
