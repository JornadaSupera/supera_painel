/**
 * Domínio de Relatórios — o conjunto fechado de 12 do escopo contratado.
 *
 * "Conjunto fechado" é a decisão de produto que a tela materializa: filtros
 * pré-configurados entregam a maior parte do valor com uma fração da
 * complexidade, e cruzamento livre fica para quando houver histórico que o
 * justifique. Por isso a definição de cada relatório é DADO, não código de
 * tela: doze páginas copiadas seriam doze lugares para corrigir o mesmo bug.
 */

export type CategoriaRelatorio = "pacientes" | "clinico" | "operacional" | "qualidade";

export const CATEGORIA_RELATORIO_LABEL: Record<CategoriaRelatorio, string> = {
  pacientes: "Pacientes",
  clinico: "Clínico",
  operacional: "Operacional",
  qualidade: "Qualidade & experiência",
};

/** Um filtro que o relatório aceita — o que vira chip no cartão. */
export type FiltroRelatorio = "periodo" | "protocolo" | "cid" | "fase" | "especialidade" | "efeito";

export const FILTRO_RELATORIO_LABEL: Record<FiltroRelatorio, string> = {
  periodo: "Período",
  protocolo: "Protocolo",
  cid: "CID",
  fase: "Fase do tratamento",
  especialidade: "Especialidade",
  efeito: "Efeito",
};

export interface DefinicaoRelatorio {
  /** Identificador estável, usado na rota `/relatorios/:slug`. */
  slug: string;
  /** Numeração do protótipo: "01" a "12". É como a clínica se refere a eles. */
  numero: string;
  categoria: CategoriaRelatorio;
  titulo: string;
  descricao: string;
  filtros: FiltroRelatorio[];
  /**
   * `false` quando o backend não tem como produzir o relatório.
   *
   * A definição continua na lista, e não sumindo da tela, porque o conjunto de
   * doze é contratado: o cartão precisa existir para que se veja o que falta —
   * e `motivo` diz exatamente o quê.
   */
  disponivel: boolean;
  motivo?: string;
}

export interface ColunaRelatorio {
  key: string;
  label: string;
  /** Alinha à direita e usa dígitos tabulares. */
  numerica?: boolean;
}

/** O resultado de rodar um relatório: colunas descritas e linhas achatadas. */
export interface ResultadoRelatorio {
  slug: string;
  titulo: string;
  colunas: ColunaRelatorio[];
  linhas: Record<string, string | number>[];
  /** Frase curta que resume o recorte: "últimos 30 dias · 81 pacientes". */
  resumo: string;
  /** Chave da coluna que serve de eixo no gráfico, quando houver. */
  eixo?: string;
  /** Chave da coluna numérica principal, quando houver. */
  medida?: string;
}
