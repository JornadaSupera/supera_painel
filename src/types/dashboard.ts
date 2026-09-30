import type { Periodo } from "@/lib/enums";

/**
 * Tipos do painel executivo.
 *
 * Ficam aqui, e não num adapter, porque o **contrato** precisa deles e
 * não pode depender de um adapter — a direção correta é adapter → contrato.
 * Quando o Supabase entrar, `adapters/supabase/dashboard.ts` importa
 * exatamente estes mesmos tipos.
 */

export type VariacaoUnidade = "%" | "pp" | "";

export interface Kpi {
  id: string;
  label: string;
  /**
   * `null` quando o período não tem base para o cálculo (sem conversa respondida,
   * sem resposta de pesquisa). O cartão fica no lugar, com um traço: sumir do
   * painel ao trocar de período fazia o número parecer ter deixado de existir.
   */
  valor: number | null;
  /** Sufixo junto ao valor: "%", "min". */
  unidade?: string;
  /** Ausente quando o indicador não se compara a um período anterior. */
  variacao?: number;
  /** "%" percentual · "pp" pontos percentuais · "" absoluto. */
  variacao_unidade?: VariacaoUnidade;
  /** Base de comparação: "mês", "semana", "dia". */
  variacao_periodo?: string;
  /** Linha de contexto sob o valor: "em tratamento". */
  contexto: string;
  /** Quando cair é bom — alertas, tempo de resposta. */
  inverter_cor?: boolean;
  historico: number[];
  /** Relatório aberto pelo drill-down. */
  relatorio_slug?: string;
  /**
   * Nível do escopo contratado. Indicador marcado como "medio" só existe
   * porque contratamos MVP + Médio — no protótipo ele some ao alternar o
   * seletor para MVP.
   */
  nivel?: "mvp" | "medio";
}

export interface PontoSessoes {
  periodo: string;
  sessoes: number;
}

export interface FatiaCid {
  nome: string;
  valor: number;
  descricao: string;
}

/**
 * Uma barra do gráfico de efeitos: o protocolo e, para cada efeito, a
 * prevalência em %. Plana de propósito, porque é assim que o gráfico lê; quais
 * chaves existem está em `SeriesResposta.efeitos`.
 */
export interface EfeitoPorProtocolo {
  [efeito: string]: string | number;
  protocolo: string;
}

/** Um efeito adverso que o gráfico desenha como série. */
export interface EfeitoDoGrafico {
  key: string;
  label: string;
}

export interface PontoEngajamento {
  periodo: string;
  engajamento: number;
}

export interface KpisResposta {
  periodo: Periodo;
  kpis: Kpi[];
  /** Momento da apuração — o dashboard exibe "atualizado às…". */
  atualizado_em: string;
}

export interface SeriesResposta {
  periodo: Periodo;
  sessoes: PontoSessoes[];
  meta_sessoes: number;
  ocupacao_percentual: number;
  pacientes_por_cid: FatiaCid[];
  /** Os efeitos mais relatados no recorte, na ordem das séries. */
  efeitos: EfeitoDoGrafico[];
  efeitos_por_protocolo: EfeitoPorProtocolo[];
  engajamento: PontoEngajamento[];
  atualizado_em: string;
}
