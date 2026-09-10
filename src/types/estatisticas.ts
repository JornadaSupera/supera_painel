/**
 * Domínio de Estatísticas — números agregados, sem identificação.
 *
 * Nada aqui carrega nome, CPF ou id de paciente: a unidade é a CONTAGEM. É o
 * que o escopo pede ("todos os números agregados, sem identificação") e é o que
 * permite a tela ser aberta em reunião, congresso ou auditoria.
 *
 * > [!] Agregar não é inferir.
 * Contar quantos pacientes de um protocolo relataram um sintoma em grau 2 ou
 * mais é aritmética sobre o que eles próprios registraram. Dizer o que fazer a
 * respeito seria conduta clínica, e isso o painel não faz — nem calcula risco,
 * nem prioriza, nem sugere tratamento.
 */

/* -------------------------------------------------------------------------
   CLÍNICAS — Protocolo × Efeito × Grau
   ------------------------------------------------------------------------- */

/** Um quadrado do mapa de calor. */
export interface CelulaCruzamento {
  protocolo: string;
  sintoma_id: string;
  sintoma_label: string;
  /** Pacientes do protocolo que relataram o sintoma no grau mínimo ou acima. */
  pacientes_com: number;
  /** Pacientes do protocolo no recorte — o denominador. */
  pacientes_total: number;
  /**
   * Prevalência, de 0 a 100. `null` quando o denominador é zero: sem paciente
   * no protocolo não existe percentual, e imprimir 0 % afirmaria ausência de
   * sintoma onde não houve ninguém para relatar.
   */
  percentual: number | null;
}

export interface CruzamentoClinico {
  /** Linhas do mapa, na ordem em que a tela deve desenhá-las. */
  protocolos: string[];
  /** Colunas do mapa. */
  sintomas: { id: string; label: string }[];
  celulas: CelulaCruzamento[];
  grau_minimo: number;
  /** Quantos pacientes entraram na conta, somando todos os protocolos. */
  pacientes_considerados: number;
  /** Quantos registros de diário foram lidos para montar o cruzamento. */
  registros_considerados: number;
  /**
   * `true` quando a leitura bateu no teto e o cruzamento é PARCIAL.
   *
   * A tela precisa dizer isso: um percentual calculado sobre uma amostra
   * truncada, apresentado como se fosse a base inteira, é o tipo de número que
   * vira decisão errada numa reunião.
   */
  truncado: boolean;
}

/** Média de prevalência por protocolo — a leitura comparativa da tela. */
export interface ComparacaoProtocolo {
  protocolo: string;
  pacientes_total: number;
  /** Média dos percentuais dos sintomas do protocolo. `null` sem denominador. */
  prevalencia_media: number | null;
}

/* -------------------------------------------------------------------------
   OPERACIONAIS — a operação da clínica
   ------------------------------------------------------------------------- */

/** Um indicador do topo da tela operacional. */
export interface IndicadorOperacional {
  chave: string;
  label: string;
  valor: number | null;
  unidade: string;
  contexto: string;
  /** Quando cair é bom — tempo de resposta, taxa de falta. */
  inverter_cor?: boolean;
}

/** Uma linha da tabela por especialidade. */
export interface LinhaEspecialidade {
  especialidade: string;
  label: string;
  volume: number;
  faltas: number;
  cancelamentos: number;
  remarcacoes: number;
}

/** Um ponto da série de volume mensal. */
export interface PontoVolume {
  /** Rótulo do mês, já em pt-BR: "mar/26". */
  mes: string;
  total: number;
}

export interface EstatisticasOperacionais {
  indicadores: IndicadorOperacional[];
  por_especialidade: LinhaEspecialidade[];
  volume_mensal: PontoVolume[];
  /**
   * Indicadores que a tela mostra no protótipo e o backend não sabe calcular.
   * Vêm nomeados para que a interface diga QUAIS faltam.
   */
  sem_origem: string[];
}
