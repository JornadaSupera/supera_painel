/**
 * CONTRATO DE DADOS
 * =============================================================================
 * Define a forma de TODO request e TODO response da camada de dados. É o único
 * ponto onde o mock e o Supabase precisam concordar.
 *
 * Desenhado para mapear 1:1 no PostgREST/Supabase:
 *   { page, pageSize }     -> .range(from, to)
 *   { field, direction }   -> .order(field, { ascending })
 *   filters                -> .eq() / .in()
 *   search                 -> .or(...ilike)
 *   { data, count, error } -> resposta nativa do supabase-js
 *
 * Com TypeScript `strict`, esse contrato deixa de ser convenção e passa a ser
 * verificado em tempo de compilação: um adapter que não o cumpre não builda.
 */

/* -------------------------------------------------------------------------
   REQUEST
   ------------------------------------------------------------------------- */

export type SortDirection = "asc" | "desc";

export interface Sort {
  field: string;
  direction: SortDirection;
}

/** Recorte temporal. Sempre ISO 8601 UTC. */
export interface DateRange {
  from: string;
  to: string;
}

export type FilterValue = string | string[] | number | boolean | undefined | null;

export interface ListParams {
  /** 1-based. */
  page?: number;
  pageSize?: number;
  sort?: Sort | null;
  /** `{ campo: valor }` — array vira `.in()`, valor único vira `.eq()`. */
  filters?: Record<string, FilterValue>;
  search?: string;
  range?: DateRange | null;
}

/** ListParams com todos os padrões aplicados e os índices de página resolvidos. */
export interface NormalizedListParams {
  page: number;
  pageSize: number;
  sort: Sort | null;
  filters: Record<string, FilterValue>;
  search: string;
  range: DateRange | null;
  /** Índices inclusivos, prontos para `.range(from, to)`. */
  from: number;
  to: number;
}

/* -------------------------------------------------------------------------
   RESPONSE
   ------------------------------------------------------------------------- */

export interface ApiError {
  /** Mensagem pronta para o usuário, em pt-BR. */
  message: string;
  /** Código estável, seguro para `switch`. */
  code: ErrorCode;
  details?: unknown;
}

export interface ListResult<T> {
  /** Página atual. */
  data: T[];
  /** Total SEM paginação — é dele que sai "1–20 de 81". */
  count: number;
  error: ApiError | null;
}

export interface SingleResult<T> {
  data: T | null;
  error: ApiError | null;
}

export interface FailResult {
  data: null;
  count: 0;
  error: ApiError;
}

/* -------------------------------------------------------------------------
   CÓDIGOS DE ERRO
   Estáveis e independentes de backend. O adapter traduz o erro nativo
   (mock ou PostgREST) para um destes; a tela só conhece estes.
   ------------------------------------------------------------------------- */

export const ERROR_CODE = {
  NETWORK: "NETWORK",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export const ERROR_MESSAGE: Record<ErrorCode, string> = {
  NETWORK: "Não foi possível conectar. Verifique sua conexão.",
  UNAUTHORIZED: "Sua sessão expirou. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para acessar este conteúdo.",
  NOT_FOUND: "Registro não encontrado.",
  VALIDATION: "Verifique os dados informados.",
  CONFLICT: "Este registro foi alterado por outra pessoa.",
  RATE_LIMITED: "Muitas tentativas. Aguarde alguns instantes.",
  NOT_IMPLEMENTED: "Funcionalidade ainda não disponível.",
  UNKNOWN: "Algo deu errado. Tente novamente.",
};

/* -------------------------------------------------------------------------
   CONSTRUTORES
   Usados pelos adapters para nunca montar resposta na mão.
   ------------------------------------------------------------------------- */

export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export function normalizeListParams(params: ListParams = {}): NormalizedListParams {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || DEFAULT_PAGE_SIZE);

  return {
    page,
    pageSize,
    sort: params.sort ?? null,
    filters: params.filters ?? {},
    search: (params.search ?? "").trim(),
    range: params.range ?? null,
    from: (page - 1) * pageSize,
    to: page * pageSize - 1,
  };
}

export function ok<T>(data: T[], count?: number): ListResult<T> {
  return { data, count: count ?? data.length, error: null };
}

export function okOne<T>(data: T | null): SingleResult<T> {
  return { data: data ?? null, error: null };
}

export function fail(code: ErrorCode, message?: string, details?: unknown): FailResult {
  return {
    data: null,
    count: 0,
    error: {
      code,
      message: message || ERROR_MESSAGE[code],
      ...(details !== undefined ? { details } : {}),
    },
  };
}

/** Erro do contrato como `Error`, para o TanStack Query tratar. */
export class ApiException extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiException";
    this.code = error.code;
    this.details = error.details;
  }
}

/** Converte `{ error }` em exceção — é o formato que o TanStack Query espera. */
export function throwIfError<T extends { error: ApiError | null }>(result: T): T {
  if (result.error) throw new ApiException(result.error);
  return result;
}

/* -------------------------------------------------------------------------
   PAGINAÇÃO
   ------------------------------------------------------------------------- */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  count: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  firstItem: number;
  lastItem: number;
}

export function paginationMeta({
  page,
  pageSize,
  count,
}: {
  page: number;
  pageSize: number;
  count: number;
}): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return {
    page,
    pageSize,
    count,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages,
    firstItem: count === 0 ? 0 : (page - 1) * pageSize + 1,
    lastItem: Math.min(page * pageSize, count),
  };
}
