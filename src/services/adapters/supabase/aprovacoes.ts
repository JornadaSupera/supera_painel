import { ACAO_REVISAO, STATUS_CONTEUDO } from "@/lib/enums";
import type { ListParams, ListResult, SingleResult } from "@/services/contracts";
import type { ComparacaoVersoes, ConteudoDetalhe, ConteudoListItem } from "@/types/conteudo";
import { getDiff as compararVersoes, list, revisar } from "./conteudos";

/**
 * Aprovação de conteúdo — a fila, e as três decisões que a esvaziam.
 *
 * É o mesmo dado de `conteudos`, recortado pela pergunta que a tela faz: o que
 * está esperando alguém decidir. Por isso este arquivo não consulta o banco por
 * conta própria — ele reusa a projeção de `./conteudos`, e assim a fila e a
 * biblioteca nunca discordam sobre o que é uma versão em revisão.
 *
 * O protótipo mostra a fila e a lista de publicados na MESMA tela, e é assim
 * que fica: não existe rota `/conteudo/aprovacoes`.
 */

/**
 * O que aguarda decisão.
 *
 * "Em revisão" é o único estado que pede ação de um administrador. Rascunho e
 * devolvido estão com o autor; publicado e rejeitado já foram decididos.
 */
export async function listQueue(params: ListParams = {}): Promise<ListResult<ConteudoListItem>> {
  return list({
    ...params,
    filters: { ...params.filters, status: STATUS_CONTEUDO.EM_REVISAO },
    // A fila é ordenada pelo que espera há mais tempo. Quem esperou mais
    // aparece primeiro, e não o que foi enviado por último.
    sort: params.sort ?? { field: "atualizado_em", direction: "asc" },
  });
}

/** A versão em revisão ao lado da anterior. Ver `conteudos.getDiff`. */
export async function getDiff(params: { id: string }): Promise<SingleResult<ComparacaoVersoes>> {
  return compararVersoes(params);
}

/** Aprovar publica: o banco arquiva sozinho a versão que estava no ar. */
export async function approve({ id }: { id: string }): Promise<SingleResult<ConteudoDetalhe>> {
  return revisar({ id, acao: ACAO_REVISAO.APROVAR });
}

/** Devolver ao autor para ajuste. O comentário é obrigatório — o banco cobra. */
export async function requestChanges({
  id,
  comentario,
}: {
  id: string;
  comentario: string;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return revisar({ id, acao: ACAO_REVISAO.DEVOLVER, comentario });
}

/** Rejeitar encerra a versão. Também exige comentário. */
export async function reject({
  id,
  comentario,
}: {
  id: string;
  comentario: string;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return revisar({ id, acao: ACAO_REVISAO.REJEITAR, comentario });
}
