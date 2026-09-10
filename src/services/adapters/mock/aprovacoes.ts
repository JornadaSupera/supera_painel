import { ACAO_REVISAO, STATUS_CONTEUDO } from "@/lib/enums";
import type { ListParams, ListResult, SingleResult } from "@/services/contracts";
import type { ComparacaoVersoes, ConteudoDetalhe, ConteudoListItem } from "@/types/conteudo";
import { getDiff as compararVersoes, list, revisar } from "./conteudos";

/**
 * Fila de aprovação — o mesmo recorte que o adapter Supabase faz.
 *
 * Reusa `./conteudos` em vez de manter a própria cópia dos dados: a fila é uma
 * pergunta sobre a biblioteca, não uma segunda biblioteca. Duplicar aqui seria
 * garantir que aprovar na fila não mudasse nada na lista de publicados.
 */

export async function listQueue(params: ListParams = {}): Promise<ListResult<ConteudoListItem>> {
  return list({
    ...params,
    filters: { ...params.filters, status: STATUS_CONTEUDO.EM_REVISAO },
    sort: params.sort ?? { field: "atualizado_em", direction: "asc" },
  });
}

export async function getDiff(params: { id: string }): Promise<SingleResult<ComparacaoVersoes>> {
  return compararVersoes(params);
}

export async function approve({ id }: { id: string }): Promise<SingleResult<ConteudoDetalhe>> {
  return revisar({ id, acao: ACAO_REVISAO.APROVAR });
}

export async function requestChanges({
  id,
  comentario,
}: {
  id: string;
  comentario: string;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return revisar({ id, acao: ACAO_REVISAO.DEVOLVER, comentario });
}

export async function reject({
  id,
  comentario,
}: {
  id: string;
  comentario: string;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return revisar({ id, acao: ACAO_REVISAO.REJEITAR, comentario });
}
