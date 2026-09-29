import { STATUS_CONTEUDO, type StatusConteudo } from "@/lib/enums";

/**
 * Rules of an orientation that the form, both adapters and the database agree on.
 *
 * The database has the last word — these are checked first so the author learns
 * what is wrong at the field, not from a refused write.
 */

/** Only https links to YouTube or Vimeo: the table has a CHECK with this shape. */
const VIDEO_URL_PATTERN = /^https:\/\/([a-z0-9-]+\.)?(youtube\.com|youtu\.be|vimeo\.com)\//;

export function isSupportedVideoUrl(url: string): boolean {
  return VIDEO_URL_PATTERN.test(url.trim());
}

export const CONTENT_TITLE_MAX = 160;
export const CONTENT_BODY_MAX = 20_000;
export const CONTENT_READING_MINUTES_MAX = 240;

/** A version can be edited while it is a draft, returned or not. */
export function isEditableStatus(status: StatusConteudo): boolean {
  return status === STATUS_CONTEUDO.RASCUNHO || status === STATUS_CONTEUDO.DEVOLVIDO;
}
