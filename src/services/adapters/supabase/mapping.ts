import {
  ACAO_AUDITORIA,
  ESPECIALIDADE,
  FASE_TRATAMENTO,
  type AcaoAuditoria,
  type Especialidade,
  type FaseTratamento,
} from "@/lib/enums";

/**
 * VOCABULÁRIO DO BANCO × VOCABULÁRIO DO PAINEL
 * =============================================================================
 * O banco e o painel nomeiam as mesmas coisas de formas diferentes, e a
 * tradução mora inteira aqui. Espalhá-la pelos adapters faria cada consulta
 * inventar a sua — e a primeira divergência apareceria como um filtro que não
 * filtra nada, sem erro nenhum.
 *
 * Duas assimetrias que este arquivo NÃO resolve, porque não são de tradução:
 *
 *  - `manutencao` é fase no painel e não existe em `treatment_phases`.
 *    Nenhum paciente volta com ela; o filtro correspondente vem sempre vazio.
 *  - `gestor` é papel no painel e não existe como perfil no banco. Só há
 *    `admins` e `professionals`.
 *
 * Ambas são decisão de produto pendente, não bug de mapeamento.
 */

/* -------------------------------------------------------------------------
   ESPECIALIDADES — `specialties.code`
   ------------------------------------------------------------------------- */

/** Código no banco → código do painel. */
const ESPECIALIDADE_POR_CODIGO: Record<string, Especialidade> = {
  oncology: ESPECIALIDADE.MEDICO,
  pharmacy: ESPECIALIDADE.FARMACEUTICO,
  nursing: ESPECIALIDADE.ENFERMEIRO,
  nutrition: ESPECIALIDADE.NUTRICIONISTA,
  psychology: ESPECIALIDADE.PSICOLOGO,
  dentistry: ESPECIALIDADE.DENTISTA,
  physiotherapy: ESPECIALIDADE.FISIOTERAPEUTA,
};

/** Código do painel → código no banco. Derivado, para não sair de sincronia. */
const CODIGO_POR_ESPECIALIDADE = Object.fromEntries(
  Object.entries(ESPECIALIDADE_POR_CODIGO).map(([codigo, especialidade]) => [especialidade, codigo]),
) as Record<Especialidade, string>;

export function paraEspecialidade(codigo: string | null | undefined): Especialidade | null {
  return codigo ? (ESPECIALIDADE_POR_CODIGO[codigo] ?? null) : null;
}

export function paraCodigoDeEspecialidade(especialidade: Especialidade): string {
  return CODIGO_POR_ESPECIALIDADE[especialidade];
}

/* -------------------------------------------------------------------------
   FASE DO TRATAMENTO — `treatment_phases.code`
   ------------------------------------------------------------------------- */

const FASE_POR_CODIGO: Record<string, FaseTratamento> = {
  ativo: FASE_TRATAMENTO.ATIVO,
  remissao: FASE_TRATAMENTO.REMISSAO,
  seguimento: FASE_TRATAMENTO.SEGUIMENTO,
  finalizacao: FASE_TRATAMENTO.FINALIZACAO,
};

export function paraFase(codigo: string | null | undefined): FaseTratamento | null {
  return codigo ? (FASE_POR_CODIGO[codigo] ?? null) : null;
}

/* -------------------------------------------------------------------------
   AÇÃO DE AUDITORIA — enum `audit_action`
   ------------------------------------------------------------------------- */

/**
 * O banco registra quatro verbos; o painel exibe sete categorias. As três que
 * sobram — `sigiloso`, `login`, `logout` — não têm origem em `audit_log`:
 * sigilo é decidido por `clinical_visibility` na própria linha lida, e o ciclo
 * de sessão é do GoTrue, que não escreve nesta tabela.
 */
const ACAO_POR_VERBO: Record<string, AcaoAuditoria> = {
  read: ACAO_AUDITORIA.LEITURA,
  create: ACAO_AUDITORIA.EDICAO,
  update: ACAO_AUDITORIA.EDICAO,
  delete: ACAO_AUDITORIA.EXCLUSAO,
};

export function paraAcaoAuditoria(verbo: string | null | undefined): AcaoAuditoria {
  return (verbo ? ACAO_POR_VERBO[verbo] : undefined) ?? ACAO_AUDITORIA.LEITURA;
}

/* -------------------------------------------------------------------------
   IDENTIFICADOR EXIBIDO DO PACIENTE
   ------------------------------------------------------------------------- */

/**
 * `patients` não tem coluna de código interno da clínica — o protótipo mostra
 * "PAC-0042", o banco tem só o UUID.
 *
 * Derivamos um identificador curto e estável a partir do próprio id, em vez de
 * numerar por ordem de chegada: sequência calculada no cliente muda de valor
 * quando a lista muda, e um "código de paciente" que muda sozinho é pior do
 * que nenhum. Quando a clínica definir o código real, ele vira coluna e esta
 * função sai.
 */
export function codigoExibidoDoPaciente(id: string): string {
  return `PAC-${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}
