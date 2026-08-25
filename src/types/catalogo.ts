/**
 * Catálogos clínicos — CID-10 e protocolos terapêuticos.
 *
 * São tabelas de apoio: mudam pouco, alimentam <Select> de filtro e de
 * cadastro, e são referenciadas por chave estrangeira a partir de `pacientes`.
 *
 * Na Fase 15 o CID-10 pode vir do Gemed (Anexo I, 1 — leitura de cadastro,
 * plano terapêutico e CID-10). Enquanto a integração não existe, o catálogo é
 * local — e a assinatura da operação já é a mesma.
 */

export interface Cid {
  /** Chave natural: "C50.9". É o que o Gemed devolve. */
  codigo: string;
  descricao: string;
  /** Capítulo/agrupamento do CID-10, usado para agrupar o filtro. */
  grupo: string;
}

export type ViaAdministracao = "intravenosa" | "oral" | "subcutanea";

export interface Protocolo {
  id: string;
  nome: string;
  medicamentos: string[];
  /** `null` para terapia contínua (hormonioterapia oral, por exemplo). */
  ciclos: number | null;
  via: ViaAdministracao;
  ativo: boolean;
}

/**
 * Efeito adverso catalogado (CTCAE). Alimenta o filtro de reações prévias na
 * ficha do paciente e, na Fase 12, o cruzamento Protocolo × Efeito × Grau.
 */
export interface EfeitoAdverso {
  id: string;
  nome: string;
  /** Sistema acometido — agrupa a lista. */
  sistema: string;
}
