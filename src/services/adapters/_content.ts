import {
  CONTENT_BODY_MAX,
  CONTENT_READING_MINUTES_MAX,
  CONTENT_TITLE_MAX,
  isSupportedVideoUrl,
} from "@/lib/content";
import {
  ACAO_REVISAO,
  STATUS_CONTEUDO,
  TIPO_CONTEUDO,
  type AcaoRevisao,
  type StatusConteudo,
  type TipoConteudo,
} from "@/lib/enums";
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

/**
 * The body with its marks removed: a card that shows "**pausas**" and "##" is
 * showing the syntax, not the text.
 */
function stripMarks(body: string): string {
  return body
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/^\s*(?:[-*]|\d+[.)])\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|[\s([])[*_](\S(?:.*?\S)?)[*_](?=$|[\s.,;:!?)\]])/g, "$1$2");
}

/** Opening lines of the body — the queue card shows what the text is about. */
export function summarizeBody(body: string, limit = 160): string {
  const clean = stripMarks(body).replace(/\s+/g, " ").trim();
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

/* -------------------------------------------------------------------------
   AUTHORING
   -------------------------------------------------------------------------
   Writing guidance belongs to the professional of the area, in their own
   workspace — the database requires the author to be whoever writes. The
   administrative panel reviews, approves and unpublishes; that separation
   between who drafts and who approves is why the workflow exists.
   ------------------------------------------------------------------------- */

interface EntryFields {
  titulo?: string;
  corpo?: string;
  tipo?: TipoConteudo;
  video_url?: string | null;
  minutos_leitura?: number | null;
}

/**
 * What the form already checks, checked again where the write happens: the two
 * adapters must refuse the same entries, and a mock that accepted what the
 * database rejects would have the screen promise a save that never happens.
 *
 * Fields that are absent are not checked, so an edit can send only what changed.
 */
export function invalidContentEntry(entry: EntryFields): FailResult | null {
  if (entry.titulo !== undefined) {
    const title = entry.titulo.trim();
    if (!title) return fail(ERROR_CODE.VALIDATION, "Informe o título da orientação.");
    if (title.length > CONTENT_TITLE_MAX) {
      return fail(ERROR_CODE.VALIDATION, `O título tem no máximo ${CONTENT_TITLE_MAX} caracteres.`);
    }
  }

  if (entry.corpo !== undefined) {
    const body = entry.corpo.trim();
    if (!body) return fail(ERROR_CODE.VALIDATION, "Escreva o texto da orientação.");
    if (body.length > CONTENT_BODY_MAX) {
      return fail(ERROR_CODE.VALIDATION, `O texto tem no máximo ${CONTENT_BODY_MAX} caracteres.`);
    }
  }

  if (entry.tipo === TIPO_CONTEUDO.VIDEO) {
    const url = entry.video_url?.trim();
    if (!url) return fail(ERROR_CODE.VALIDATION, "Informe o link do vídeo.");
  }

  const url = entry.video_url?.trim();
  if (url && !isSupportedVideoUrl(url)) {
    return fail(ERROR_CODE.VALIDATION, "O vídeo precisa ser um link https do YouTube ou do Vimeo.");
  }

  const minutes = entry.minutos_leitura;
  if (minutes != null && (!Number.isInteger(minutes) || minutes < 1 || minutes > CONTENT_READING_MINUTES_MAX)) {
    return fail(
      ERROR_CODE.VALIDATION,
      `O tempo de leitura vai de 1 a ${CONTENT_READING_MINUTES_MAX} minutos.`,
    );
  }

  return null;
}

/**
 * What a version needs before it can leave the draft.
 *
 * Sending it to review is the point of no return for the text, so an orientation
 * declared as a PDF has to have the PDF attached — otherwise the patient would be
 * offered a document that does not exist.
 */
export function incompleteForReview(detail: ConteudoDetalhe): FailResult | null {
  if (detail.tipo === TIPO_CONTEUDO.PDF && !detail.anexos.some((a) => a.mime_type === "application/pdf")) {
    return fail(
      ERROR_CODE.VALIDATION,
      "Uma orientação do tipo PDF precisa do arquivo PDF anexado antes de ir para revisão.",
    );
  }

  return null;
}

/**
 * The state the AUTHOR sees.
 *
 * The database has four states and no memory of why a draft is a draft: a
 * version the reviewer returned goes back to `draft`, and one they rejected goes
 * to `archived`. The last decision is what tells them apart — and the author
 * needs to know, because "returned" comes with a comment to read and "draft"
 * does not.
 */
export function statusForAuthor(
  status: StatusConteudo,
  lastAction: AcaoRevisao | null,
): StatusConteudo {
  if (status === STATUS_CONTEUDO.RASCUNHO && lastAction === ACAO_REVISAO.DEVOLVER) {
    return STATUS_CONTEUDO.DEVOLVIDO;
  }

  if (status === STATUS_CONTEUDO.DESPUBLICADO && lastAction === ACAO_REVISAO.REJEITAR) {
    return STATUS_CONTEUDO.REJEITADO;
  }

  return status;
}
