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
  origem: OrigemAuditoria;
  /**
   * `null` quando a origem dos dados não registra o endereço.
   *
   * A trilha é escrita DENTRO do banco, por gatilho, e o Postgres não enxerga
   * o IP do navegador que originou a chamada. Preencher com o IP do servidor
   * seria pior que deixar vazio: pareceria informação e não seria.
   */
  ip: string | null;
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
