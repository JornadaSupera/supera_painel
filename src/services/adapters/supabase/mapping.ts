import {
  ACAO_AUDITORIA,
  ESPECIALIDADE,
  FASE_TRATAMENTO,
  ORIGEM_AUDITORIA,
  type AcaoAuditoria,
  type Especialidade,
  type FaseTratamento,
  type OrigemAuditoria,
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

/** Código do painel → código no banco. Derivado, para não sair de sincronia. */
const CODIGO_POR_FASE = Object.fromEntries(
  Object.entries(FASE_POR_CODIGO).map(([codigo, fase]) => [fase, codigo]),
) as Record<FaseTratamento, string>;

export function paraFase(codigo: string | null | undefined): FaseTratamento | null {
  return codigo ? (FASE_POR_CODIGO[codigo] ?? null) : null;
}

/**
 * `"manutencao"` não tem código no banco e devolve `null` — ver o cabeçalho.
 * Um filtro por fase inexistente precisa virar "sem filtro reconhecido", e não
 * uma string que a função do banco recusaria.
 */
export function paraCodigoDeFase(fase: string | null | undefined): string | null {
  return fase ? (CODIGO_POR_FASE[fase as FaseTratamento] ?? null) : null;
}

/* -------------------------------------------------------------------------
   AÇÃO DE AUDITORIA — enum `audit_action`
   ------------------------------------------------------------------------- */

/**
 * O banco registra quatro verbos; o painel exibe sete categorias.
 *
 * `sigiloso` não é verbo: é a marca `is_restricted_material` sobre uma leitura,
 * e por isso se filtra por coluna própria, não por este mapa. `login` e
 * `logout` continuam sem origem — o ciclo de sessão é do GoTrue, que não
 * escreve nesta tabela. `exportacao` acontece no navegador e não chega ao
 * banco.
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

/**
 * Categoria do painel → verbos do banco, para filtrar no SERVIDOR.
 *
 * Derivado do mapa acima, e não escrito à mão: `edicao` cobre `create` e
 * `update`, e é justamente esse tipo de relação um-para-muitos que uma segunda
 * cópia erra primeiro.
 *
 * `null` = a categoria não se expressa no vocabulário do banco. Quem chama
 * precisa tratar isso como **recorte impossível** — devolver a lista inteira
 * responderia "todos os acessos" a uma pergunta sobre exportações.
 */
const VERBOS_POR_ACAO = Object.entries(ACAO_POR_VERBO).reduce<Partial<Record<AcaoAuditoria, string[]>>>(
  (mapa, [verbo, acao]) => ({ ...mapa, [acao]: [...(mapa[acao] ?? []), verbo] }),
  {},
);

export function paraVerbosDeAuditoria(acao: string | null | undefined): string[] | null {
  if (!acao) return null;
  return VERBOS_POR_ACAO[acao as AcaoAuditoria] ?? null;
}

/* -------------------------------------------------------------------------
   PROCEDÊNCIA DO REGISTRO — enum `audit_actor_capacity`
   ------------------------------------------------------------------------- */

/**
 * Em que qualidade a pessoa agiu → de onde o painel diz que o acesso veio.
 *
 * O banco guarda a **qualidade do ator** (titular, acompanhante, profissional,
 * administração, rotina), não o aplicativo de origem. A tradução é uma
 * aproximação declarada: quem age como paciente está no app do paciente, quem
 * age como acompanhante está no app do cuidador, e quem age como profissional
 * ou administrador está em um painel.
 *
 * A distinção que importa numa apuração — **o titular preencheu isto ou quem o
 * acompanha?** — é exatamente a que o banco passou a guardar, e é a que esta
 * tradução preserva. Qual das duas telas profissionais originou a chamada é
 * informação que ninguém pediu.
 *
 * `null` (registro anterior à coluna, ou escrita fora de requisição) cai em
 * `sistema`, que é o que um registro sem ator sempre significou nesta tela.
 */
const ORIGEM_POR_QUALIDADE: Record<string, OrigemAuditoria> = {
  patient: ORIGEM_AUDITORIA.APP_PACIENTE,
  caregiver: ORIGEM_AUDITORIA.APP_CUIDADOR,
  professional: ORIGEM_AUDITORIA.PAINEL,
  admin: ORIGEM_AUDITORIA.PAINEL,
  system: ORIGEM_AUDITORIA.SISTEMA,
};

export function paraOrigemDoAtor(qualidade: string | null | undefined): OrigemAuditoria {
  return (qualidade ? ORIGEM_POR_QUALIDADE[qualidade] : undefined) ?? ORIGEM_AUDITORIA.SISTEMA;
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
