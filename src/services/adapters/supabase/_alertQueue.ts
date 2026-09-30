import type { FilaDeAlertas } from "@/types/estatisticas";
import { TETO_READ, compartilharLeitura, falhaDe } from "./_helpers";
import { getSupabaseClient } from "./client";

/**
 * O VOLUME DA FILA DE ALERTAS — contado aqui, sem levar paciente para a tela.
 * =============================================================================
 * `read_alerts` devolve o alerta linha a linha, com o paciente, e grava uma
 * leitura na trilha. Este arquivo só CONTA: nenhuma linha sai dele, então o
 * Dashboard e as Estatísticas operacionais, que não identificam ninguém, podem
 * usá-lo.
 *
 * Dois limites da leitura, e os dois aparecem no resultado em vez de se
 * esconderem nele:
 *
 *  - ela devolve no máximo 200 alertas por chamada, **do mais antigo para o mais
 *    novo**. Por isso a conta é feita POR SITUAÇÃO (pendente e em atendimento,
 *    uma chamada cada): um histórico antigo de alertas resolvidos não consegue
 *    empurrar os ativos para fora das 200. Se uma situação bate no teto, o
 *    número é um mínimo e `limitado` vem verdadeiro — a tela diz "200+", nunca
 *    um total que parece exato.
 *  - ela não agrega tempo até a conduta nem desfecho. Esses dois dependem de
 *    um resumo no banco e continuam sem número.
 *
 * As duas telas que usam isto abrem juntas, então a segunda carona na primeira
 * (ver `compartilharLeitura`) em vez de gravar duas leituras na trilha.
 */

const VALIDADE_MS = 30_000;

/** Quantos alertas uma situação tem, até o teto da leitura. */
async function contarSituacao(
  situacao: "open" | "in_progress",
): Promise<number | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient().rpc("read_alerts", {
    p_status: situacao,
    p_limit: TETO_READ,
    p_before: null,
  });

  if (error) return falhaDe(error);
  return (data ?? []).length;
}

export function contarFilaDeAlertas(): Promise<FilaDeAlertas | ReturnType<typeof falhaDe>> {
  return compartilharLeitura(
    "alertas:fila",
    VALIDADE_MS,
    async () => {
      const [pendentes, emAtendimento] = await Promise.all([
        contarSituacao("open"),
        contarSituacao("in_progress"),
      ]);

      if (typeof pendentes !== "number") return pendentes;
      if (typeof emAtendimento !== "number") return emAtendimento;

      return {
        pendentes,
        em_atendimento: emAtendimento,
        limitado: pendentes >= TETO_READ || emAtendimento >= TETO_READ,
      };
    },
    (resultado) => "pendentes" in resultado,
  );
}
