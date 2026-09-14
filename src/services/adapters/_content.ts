import { ACAO_REVISAO, STATUS_CONTEUDO, type AcaoRevisao } from "@/lib/enums";
import {
  ERROR_CODE,
  fail,
  type FailResult,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type { ComparacaoVersoes, ConteudoDetalhe, ConteudoListItem } from "@/types/conteudo";

/**
 * CONTENT WORKFLOW RULES SHARED BY BOTH ADAPTERS.
 * =============================================================================
 * Each adapter owns how a version is read and how a decision is stored. What a
 * decision *means* — which ones need a comment, what the approval queue is,
 * who may write — is one rule, and it lives here once.
 */

/** Opening lines of the body — the queue card shows what the text is about. */
export function summarizeBody(body: string, limit = 160): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;

  // Cuts at a word boundary, never in the middle of one.
  return `${clean.slice(0, limit).replace(/\s+\S*$/, "")}…`;
}

/** Returning and rejecting require a comment; the database enforces the same. */
export function missingReviewComment(action: AcaoRevisao, comment: string): FailResult | null {
  const needsComment = action === ACAO_REVISAO.DEVOLVER || action === ACAO_REVISAO.REJEITAR;
  if (!needsComment || comment !== "") return null;

  return fail(
    ERROR_CODE.VALIDATION,
    "Devolver e rejeitar exigem um comentário explicando o que precisa mudar.",
  );
}

type Review = (params: {
  id: string;
  acao: AcaoRevisao;
  comentario?: string;
}) => Promise<SingleResult<ConteudoDetalhe>>;

/** Publishing and unpublishing are review decisions under another name. */
export function createPublishingOperations(review: Review) {
  return {
    publish: ({ id }: { id: string }) => review({ id, acao: ACAO_REVISAO.APROVAR }),

    unpublish: ({ id, motivo }: { id: string; motivo?: string }) =>
      review({ id, acao: ACAO_REVISAO.DESPUBLICAR, comentario: motivo }),
  };
}

/**
 * The approval queue — the same data as the library, cut by the question the
 * screen asks: what is waiting for someone to decide.
 *
 * It reuses the adapter's own content reads instead of querying on its own, so
 * the queue and the library never disagree about what a version under review
 * is. The prototype shows both on the SAME screen: there is no
 * `/conteudo/aprovacoes` route.
 */
export function createApprovalOperations({
  list,
  getDiff,
  review,
}: {
  list: (params: ListParams) => Promise<ListResult<ConteudoListItem>>;
  getDiff: (params: { id: string }) => Promise<SingleResult<ComparacaoVersoes>>;
  review: Review;
}) {
  return {
    /**
     * "Under review" is the only state that asks an administrator to act.
     * Draft and returned are with the author; published and rejected are
     * already decided.
     */
    listQueue: (params: ListParams = {}) =>
      list({
        ...params,
        filters: { ...params.filters, status: STATUS_CONTEUDO.EM_REVISAO },
        // Whoever waited longest comes first, not whatever was sent last.
        sort: params.sort ?? { field: "atualizado_em", direction: "asc" },
      }),

    /** The version under review next to the previous one. */
    getDiff,

    /** Approving publishes; the previously published version is archived. */
    approve: ({ id }: { id: string }) => review({ id, acao: ACAO_REVISAO.APROVAR }),

    /** Back to the author for changes. The comment is mandatory. */
    requestChanges: ({ id, comentario }: { id: string; comentario: string }) =>
      review({ id, acao: ACAO_REVISAO.DEVOLVER, comentario }),

    /** Rejecting closes the version. It also requires a comment. */
    reject: ({ id, comentario }: { id: string; comentario: string }) =>
      review({ id, acao: ACAO_REVISAO.REJEITAR, comentario }),
  };
}

/**
 * Writing guidance belongs to the professional of the area, in their own
 * workspace — the database requires the author to be whoever writes. The
 * administrative panel reviews, approves and unpublishes. That is not a gap,
 * it is the separation between who drafts and who approves, which is why the
 * workflow exists; a mock that accepted these would have the screen promise a
 * button the real backend denies.
 */
const AUTHOR_ONLY =
  "Quem redige a orientação é o profissional da área, no espaço de trabalho dele. O painel administrativo revisa, aprova e despublica.";

export const AUTHOR_ONLY_OPERATIONS = {
  create: async (): Promise<SingleResult<ConteudoDetalhe>> =>
    fail(ERROR_CODE.FORBIDDEN, AUTHOR_ONLY),

  update: async (): Promise<SingleResult<ConteudoDetalhe>> =>
    fail(ERROR_CODE.FORBIDDEN, AUTHOR_ONLY),

  submitForReview: async (): Promise<SingleResult<ConteudoDetalhe>> =>
    fail(
      ERROR_CODE.FORBIDDEN,
      "Enviar para revisão é o ato de quem escreveu — é assim que o texto entra nesta fila.",
    ),
};
