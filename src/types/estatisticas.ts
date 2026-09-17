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
  /**
   * Registros de sintoma no grau mínimo ou acima.
   *
   * É a única medida **exata** do cruzamento: registro soma limpo entre graus e
   * entre sintomas. Quem anotou o mesmo sintoma em vinte dias conta vinte vezes
   * aqui — é carga de relato, não prevalência.
   */
  registros: number;
  /**
   * Pacientes distintos que relataram o sintoma no grau mínimo ou acima.
   *
   * Pode ser um **piso**, não o número exato: o resumo do banco conta
   * distintos por grau, e a mesma pessoa que relatou grau 2 num dia e grau 3
   * noutro aparece nos dois baldes. Somar recontaria; o maior balde é o piso
   * seguro. `pacientes_exato` diz quando o valor é o número cheio.
   */
  pacientes_com: number;
  /** `false` quando `pacientes_com` é piso — ver acima. */
  pacientes_exato: boolean;
  /**
   * Pacientes do protocolo no recorte — o denominador.
   *
   * `null` quando a origem não o fornece. Um percentual calculado sobre
   * denominador ausente não é um percentual aproximado: é um número inventado.
   */
  pacientes_total: number | null;
  /**
   * Prevalência, de 0 a 100. `null` sem denominador, e `null` quando o
   * denominador é zero: sem paciente no protocolo não existe percentual, e
   * imprimir 0 % afirmaria ausência de sintoma onde não houve ninguém para
   * relatar.
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
  /**
   * Quantos pacientes entraram na conta, somando todos os protocolos. `null`
   * quando a origem devolve contagem por balde e não o distinto do conjunto.
   */
  pacientes_considerados: number | null;
  /** Quantos registros de diário entraram no cruzamento. */
  registros_considerados: number;
  /**
   * `true` quando as células têm percentual — isto é, quando existe denominador.
   *
   * A tela precisa da bandeira explícita em vez de inferir do primeiro
   * percentual nulo: "nenhum paciente neste protocolo" e "esta origem não
   * devolve denominador" são ausências diferentes, e a segunda muda a leitura do
   * mapa inteiro, não de uma célula.
   */
  prevalencia_disponivel: boolean;
  /** O que falta para haver percentual. Presente quando a bandeira é `false`. */
  motivo_sem_prevalencia?: string;
  /**
   * Filtros que a tela ofereceu e a origem NÃO aplicou.
   *
   * Um controle que não muda o resultado é pior que um controle ausente: quem o
   * marca passa a acreditar num recorte que não houve. A origem declara o que
   * ignorou, e a interface avisa em vez de esconder o botão — esconder faria a
   * tela divergir do protótipo sem dizer por quê.
   */
  filtros_ignorados?: string[];
  /**
   * `true` quando a leitura bateu no teto e o cruzamento é PARCIAL.
   *
   * A tela precisa dizer isso: um percentual calculado sobre uma amostra
   * truncada, apresentado como se fosse a base inteira, é o tipo de número que
   * vira decisão errada numa reunião.
   */
  truncado: boolean;
}

/** Leitura comparativa por protocolo. */
export interface ComparacaoProtocolo {
  protocolo: string;
  /** `null` quando a origem não devolve o total de pacientes do protocolo. */
  pacientes_total: number | null;
  /** Média dos percentuais dos sintomas do protocolo. `null` sem denominador. */
  prevalencia_media: number | null;
  /** Registros de sintoma do protocolo no recorte — sempre exato. */
  registros: number;
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
