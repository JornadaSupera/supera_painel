import type { AcaoAuditoria, OrigemAuditoria } from "@/lib/enums";

/**
 * Domínio de Auditoria — o rastro de quem tocou em dado sensível.
 *
 * A trilha guarda METADADO, nunca conteúdo: quem, o quê, quando e sobre qual
 * registro. O texto lido, a mensagem trocada e o valor anterior de um campo não
 * entram — uma trilha que copiasse o dado clínico dobraria a superfície de
 * exposição em vez de protegê-la.
 *
 * Os registros são imutáveis e retidos por cinco anos. Nada nesta tela edita ou
 * apaga linha de auditoria; o que ela oferece é leitura, recorte e exportação.
 */

export interface AuditoriaListItem {
  id: string;
  criado_em: string;
  acao: AcaoAuditoria;
  usuario_id: string | null;
  usuario_nome: string;
  /** Nome técnico do recurso, como a trilha o registrou. */
  recurso: string;
  /** O mesmo recurso em pt-BR, para leitura humana. */
  recurso_label: string;
  recurso_id: string | null;
  paciente_id: string | null;
  /** `null` quando o registro não é sobre um paciente específico. */
  paciente_nome: string | null;
  /**
   * Quantas linhas a operação alcançou. Distingue "abriu uma ficha" de
   * "exportou a base inteira", que é a diferença que interessa numa apuração.
   */
  linhas: number | null;
  /**
   * Em que qualidade quem agiu estava agindo — titular, acompanhante, equipe
   * ou rotina.
   *
   * É a distinção que uma apuração precisa e que a conta sozinha não dá: duas
   * pessoas usam a mesma ficha, e "o paciente relatou" e "quem o acompanha
   * relatou" levam a leituras clínicas diferentes.
   */
  origem: OrigemAuditoria;
  /**
   * Endereço de onde partiu a chamada, quando ela veio pela web.
   *
   * `null` fora de requisição HTTP — rotina agendada, gatilho interno, acesso
   * técnico direto ao banco — e nos registros anteriores à trilha passar a
   * guardá-lo. Vazio é resposta legítima aqui, e não falha de coleta.
   *
   * > [!] É indício, nunca prova.
   * O começo da cadeia de encaminhamento é declarado pelo cliente, e quem
   * controla o cliente pode declarar o que quiser. Serve para perguntar "de
   * quantos lugares esta conta abriu prontuário esta semana", não para
   * sustentar acusação contra a pessoa que agiu.
   */
  ip: string | null;
  /**
   * Houve acesso a material sob sigilo profissional — hoje, o conteúdo de
   * Psicologia, que nem a administração herda pelo papel.
   *
   * A marca diz **que** houve, jamais de quem nem qual: enriquecer a trilha
   * até o ponto de identificar a sessão faria do próprio log a indiscrição que
   * ele existe para denunciar.
   */
  material_restrito: boolean;
}

/**
 * Uma opção de filtro, derivada da própria trilha.
 *
 * As opções NÃO vêm do cadastro de usuários nem do de pacientes, e a diferença
 * é deliberada:
 *
 *  - **Não gera acesso novo.** Puxar a lista de pacientes para preencher um
 *    seletor registraria mais uma leitura de prontuário — na tela cuja função é
 *    justamente denunciar leituras de prontuário.
 *  - **Não esconde histórico.** O cadastro filtra por quem está ativo; a trilha
 *    guarda quem agiu, inclusive quem foi desativado depois. Filtrar por
 *    cadastro faria sumir exatamente o rastro que se quer investigar.
 *  - **Não oferece filtro vazio.** Só aparece quem tem linha na janela, então
 *    nenhuma escolha leva a "nenhum resultado".
 */
export interface OpcaoFiltroAuditoria {
  id: string;
  nome: string;
  /** Quantas linhas da janela são desta pessoa. Ordena e dá noção de volume. */
  total: number;
}

/** Quem aparece na janela — alimenta os seletores de usuário e de paciente. */
export interface FacetasAuditoria {
  atores: OpcaoFiltroAuditoria[];
  pacientes: OpcaoFiltroAuditoria[];
  /**
   * `true` quando a leitura bateu no teto e as opções podem não cobrir a janela
   * inteira. A tela avisa: um seletor incompleto que se apresenta como completo
   * faz quem investiga concluir que não há rastro de alguém.
   */
  truncado: boolean;
}

/** Um cartão da faixa de contadores do topo da tela. */
export interface ContagemAuditoria {
  acao: AcaoAuditoria;
  label: string;
  total: number;
}

export interface ResumoAuditoria {
  /** Tamanho da janela contada, em horas. O protótipo usa 24. */
  janela_horas: number;
  contagens: ContagemAuditoria[];
  /**
   * Categorias que o protótipo mostra e a trilha não sabe separar.
   *
   * Vêm nomeadas, e não omitidas em silêncio, para que a tela possa dizer
   * QUAIS faltam — um cartão a menos sem explicação vira suspeita de bug.
   */
  sem_origem: AcaoAuditoria[];
}
