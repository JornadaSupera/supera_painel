/**
 * As duas linhas de referência do gráfico de volume — Estatísticas operacionais.
 *
 * `operational_parameters.code` é livre no banco, mas aqui não é: o código é da
 * TELA (ver o comentário da RPC em `set_operational_parameter`), e as duas telas
 * que leem e escrevem este parâmetro — a leitura em `estatisticasOperacionais`,
 * a escrita em `configuracoes` — precisam concordar exatamente no código e no
 * rótulo. Compartilhado para que um valor não possa divergir do outro.
 */
export const METAS_OPERACIONAIS = [
  { codigo: "monthly_appointments_target", rotulo: "Meta mensal" },
  { codigo: "monthly_appointments_capacity", rotulo: "Capacidade máxima" },
] as const;

export type CodigoMetaOperacional = (typeof METAS_OPERACIONAIS)[number]["codigo"];
