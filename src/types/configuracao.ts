/**
 * Domínio de Configurações.
 *
 * O painel administrativo de hoje LÊ a configuração e não a escreve: nenhum dos
 * catálogos do banco (`symptoms`, `notification_types`, `content_categories`,
 * `conversation_subjects`, `legal_document_versions`) tem política de INSERT ou
 * UPDATE para quem opera o painel — todos são semeados por migração.
 *
 * Isso é decisão de arquitetura, não lacuna acidental: o vocabulário que
 * atravessa aplicativo, relatório e gatilho de alerta muda por migração
 * versionada, com revisão, e não por um formulário que alguém abre numa tarde.
 * A tela mostra o que está valendo e diz por que não se edita ali.
 */

/** Um item de catálogo — sintoma, tipo de notificação, categoria, assunto. */
export interface ItemCatalogo {
  id: string;
  codigo: string;
  label: string;
  /** Texto auxiliar da linha: a área dona, a categoria, o grupo. */
  detalhe: string | null;
  ativo: boolean;
}

/** Uma versão de termo de uso ou de política de privacidade. */
export interface VersaoLegal {
  id: string;
  tipo: "termos_de_uso" | "politica_de_privacidade";
  tipo_label: string;
  versao: number;
  vigente: boolean;
  publicado_em: string | null;
  corpo: string;
}

export interface Configuracoes {
  /** Os sintomas marcáveis no diário — a base dos gatilhos de alerta. */
  sintomas: ItemCatalogo[];
  /** Os tipos de notificação e se podem ser silenciados. */
  notificacoes: ItemCatalogo[];
  /** As categorias da biblioteca de orientações. */
  categorias_conteudo: ItemCatalogo[];
  /** Os assuntos que o paciente escolhe ao abrir uma conversa. */
  assuntos_chat: ItemCatalogo[];
  /**
   * Chaves de configuração que a tela de referência mostra e o banco não
   * guarda. A interface usa a lista para nomear o que falta em vez de desenhar
   * um campo vazio que ninguém consegue salvar.
   */
  sem_origem: string[];
}
