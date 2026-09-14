import { createApprovalOperations } from "../_content";
import { getDiff as compararVersoes, list, revisar } from "./conteudos";

/**
 * Aprovação de conteúdo — a fila, e as três decisões que a esvaziam.
 *
 * Toda decisão passa por `revisar`, que chama `review_content_version`: o banco
 * arquiva sozinho a versão que estava no ar ao aprovar e cobra o comentário ao
 * devolver ou rejeitar.
 */
export const { listQueue, getDiff, approve, requestChanges, reject } = createApprovalOperations({
  list,
  getDiff: compararVersoes,
  review: revisar,
});
