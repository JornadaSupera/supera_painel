import type {
  AcaoRevisao,
  Especialidade,
  StatusConteudo,
  TipoConteudo,
} from "@/lib/enums";

/**
 * Domínio de Conteúdo — as orientações que chegam ao aplicativo do paciente.
 *
 * A unidade desta tela é a VERSÃO, não a orientação.
 *
 * Uma orientação é uma identidade estável ("Alimentação em períodos de
 * náusea"); o que se aprova, se devolve e se publica é sempre uma versão dela.
 * Por isso `id` aqui é o id da versão, e `orientacao_id` é o da orientação —
 * inverter os dois faria a aprovação cair na linha errada, e o sintoma seria
 * publicar um texto que ninguém revisou.
 *
 * O corpo é MARKDOWN SIMPLES (negrito, itálico, títulos e listas), nunca HTML.
 * Nada aqui passa por `dangerouslySetInnerHTML`: o texto vira elementos do React
 * (`MarkdownText`), então não existe caminho de injeção a sanitizar. Um texto
 * sem marcação — como os que já existem — é Markdown válido.
 */

export interface ConteudoListItem {
  /** Id da VERSÃO. É ele que a revisão recebe. */
  id: string;
  /** Id da ORIENTAÇÃO, estável entre versões. */
  orientacao_id: string;
  titulo: string;
  /** Primeiras linhas do corpo, para o cartão da fila. */
  resumo: string;
  versao: number;
  status: StatusConteudo;
  tipo: TipoConteudo;
  categoria: string;
  categoria_id: string;
  /**
   * Especialidade dona da categoria. `null` em categoria transversal, como
   * "Medicação Oral" — que não pertence a nenhuma área isolada.
   */
  especialidade: Especialidade | null;
  /**
   * A orientação é de uma área sob sigilo profissional (Psicologia).
   *
   * Descreve a área, e não restringe a leitura da orientação: quem a revisa é o
   * administrador, e o sigilo da Psicologia protege o que é dito em atendimento
   * (anotações, conversas, compromissos), não um material educativo.
   */
  confidencial: boolean;
  autor_nome: string;
  autor_id: string | null;
  criado_em: string;
  atualizado_em: string;
  /**
   * Acessos do paciente. `null` quando a origem dos dados não expõe a
   * contagem — que é diferente de zero, e não deve virar "ninguém leu".
   */
  visualizacoes: number | null;
}

/** Uma categoria em que o profissional pode escrever: as da sua especialidade. */
export interface CategoriaConteudo {
  id: string;
  label: string;
  especialidade: Especialidade | null;
}

/** Um arquivo anexado a uma versão em rascunho. O conteúdo se baixa à parte. */
export interface AnexoConteudo {
  id: string;
  /** Caminho no bucket: `<id da versão>/<pasta>/<nome>`. */
  caminho: string;
  nome: string;
  mime_type: string;
  tamanho: number;
}

export interface ConteudoDetalhe extends ConteudoListItem {
  corpo: string;
  video_url: string | null;
  minutos_leitura: number | null;
  /** Marcação por CID. Lista vazia = orientação universal, por decisão. */
  cids: { code: string; label: string }[];
  /** Decisões já tomadas sobre esta versão, da mais recente para a mais antiga. */
  revisoes: RevisaoConteudo[];
  anexos: AnexoConteudo[];
}

/** Uma decisão registrada no workflow: quem decidiu o quê, quando e por quê. */
export interface RevisaoConteudo {
  id: string;
  acao: AcaoRevisao;
  revisor_nome: string;
  comentario: string | null;
  criado_em: string;
}

/**
 * Duas versões lado a lado, para a revisão comparar o que mudou.
 *
 * `anterior` é `null` na primeira versão de uma orientação — não há com o que
 * comparar, e mostrar um painel vazio ao lado seria pior do que não mostrar.
 */
export interface ComparacaoVersoes {
  atual: ConteudoDetalhe;
  anterior: ConteudoDetalhe | null;
}

/**
 * Entrada de criação/edição. Quem escreve é o profissional, no espaço dele; o
 * painel administrativo revisa e nunca chama isto.
 */
export interface ConteudoEntrada {
  titulo: string;
  corpo: string;
  categoria_id: string;
  tipo: TipoConteudo;
  video_url?: string | null;
  minutos_leitura?: number | null;
  /** Códigos CID-10 ("C50.9"), não ids: o código é a chave natural do catálogo. */
  cids?: string[];
}
