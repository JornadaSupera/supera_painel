import { createApprovalOperations } from "../_content";
import { getDiff as compararVersoes, list, revisar } from "./conteudos";

/**
 * Fila de aprovação — o mesmo recorte que o adapter Supabase faz.
 *
 * Reusa `./conteudos` em vez de manter a própria cópia dos dados: a fila é uma
 * pergunta sobre a biblioteca, não uma segunda biblioteca. Duplicar aqui seria
 * garantir que aprovar na fila não mudasse nada na lista de publicados.
 */
export const { listQueue, getDiff, approve, requestChanges, reject } = createApprovalOperations({
  list,
  getDiff: compararVersoes,
  review: revisar,
});
