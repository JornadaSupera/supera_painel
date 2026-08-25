import { MOCK } from "@/lib/env";
import {
  ERROR_CODE,
  fail,
  normalizeListParams,
  ok,
  type FilterValue,
  type DateRange,
  type ListParams,
  type ListResult,
  type Sort,
} from "@/services/contracts";

/**
 * Infra compartilhada dos mocks.
 *
 * Reproduz o comportamento de um backend real — latência, paginação,
 * ordenação, busca e falha ocasional — para que os estados de Loading, Vazio e
 * Erro sejam exercitados de verdade durante o desenvolvimento, e não apenas
 * "no papel".
 */

type Row = Record<string, unknown>;

/* -------------------------------------------------------------------------
   LATÊNCIA E FALHA SIMULADA
   ------------------------------------------------------------------------- */

/** Espera um tempo aleatório dentro da faixa configurada no `.env`. */
export function delay(min = MOCK.delayMin, max = MOCK.delayMax): Promise<void> {
  const ms = min + Math.random() * Math.max(0, max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Com `VITE_MOCK_ERROR_RATE > 0`, parte das chamadas falha de propósito. */
export function shouldFail(): boolean {
  return MOCK.errorRate > 0 && Math.random() * 100 < MOCK.errorRate;
}

/**
 * Envelope padrão de toda operação mockada: aplica latência e falha simulada
 * antes de executar. Nenhum mock deve chamar `delay()` na mão.
 */
export async function simulate<T>(fn: () => T): Promise<T | ReturnType<typeof fail>> {
  await delay();

  if (shouldFail()) {
    return fail(ERROR_CODE.NETWORK, "Falha simulada de rede (VITE_MOCK_ERROR_RATE).");
  }

  return fn();
}

/* -------------------------------------------------------------------------
   BUSCA, FILTRO E ORDENAÇÃO
   Espelham a semântica do PostgREST para que o adapter Supabase produza o
   MESMO resultado sem que a tela perceba a troca.
   ------------------------------------------------------------------------- */

/** Remove acento e caixa — busca tolerante, como `unaccent` no Postgres. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Busca textual em vários campos — equivale a `.or(...ilike)`. */
export function matchSearch(row: Row, search: string, fields: string[]): boolean {
  if (!search) return true;

  const needle = normalizeText(search);
  return fields.some((field) => normalizeText(getPath(row, field)).includes(needle));
}

/**
 * Filtros por igualdade. Array vira `.in()`, valor único vira `.eq()`.
 * Valores vazios (`""`, `null`, `undefined`, `"todos"`) são ignorados.
 */
export function matchFilters(row: Row, filters: Record<string, FilterValue> = {}): boolean {
  return Object.entries(filters).every(([field, expected]) => {
    if (expected === undefined || expected === null || expected === "" || expected === "todos") {
      return true;
    }

    const actual = getPath(row, field);

    if (Array.isArray(expected)) {
      return expected.length === 0 || expected.includes(String(actual));
    }

    return String(actual) === String(expected);
  });
}

/** Recorte temporal — equivale a `.gte(field, from).lte(field, to)`. */
export function matchRange(row: Row, range: DateRange | null, field = "criado_em"): boolean {
  if (!range?.from || !range?.to) return true;

  const value = new Date(String(getPath(row, field))).getTime();
  return value >= new Date(range.from).getTime() && value <= new Date(range.to).getTime();
}

/** Ordenação estável, com `localeCompare` pt-BR e nulos por último. */
export function applySort<T extends Row>(rows: T[], sort: Sort | null): T[] {
  if (!sort?.field) return rows;

  const dir = sort.direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const av = getPath(a, sort.field);
    const bv = getPath(b, sort.field);

    if (av === bv) return 0;
    // Nulos por último, como o Postgres faz por padrão.
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;

    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;

    const ad = Date.parse(String(av));
    const bd = Date.parse(String(bv));
    if (!Number.isNaN(ad) && !Number.isNaN(bd)) return (ad - bd) * dir;

    return String(av).localeCompare(String(bv), "pt-BR", { numeric: true }) * dir;
  });
}

/** Suporta caminho aninhado: `getPath(row, "paciente.nome")`. */
export function getPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) => (acc == null ? acc : (acc as Record<string, unknown>)[key]),
      obj,
    );
}

/* -------------------------------------------------------------------------
   PIPELINE DE LISTAGEM
   ------------------------------------------------------------------------- */

export interface PaginateOptions {
  searchFields?: string[];
  rangeField?: string;
}

/**
 * Aplica busca → filtros → recorte → ordenação → paginação e devolve um
 * `ListResult` do contrato. É o que todo `list()` de mock deve usar.
 */
export function paginate<T extends Row>(
  rows: T[],
  params: ListParams,
  { searchFields = [], rangeField = "criado_em" }: PaginateOptions = {},
): ListResult<T> {
  const { sort, filters, search, range, from, to } = normalizeListParams(params);

  const filtered = rows.filter(
    (row) =>
      matchSearch(row, search, searchFields) &&
      matchFilters(row, filters) &&
      matchRange(row, range, rangeField),
  );

  const sorted = applySort(filtered, sort);

  return ok(sorted.slice(from, to + 1), sorted.length);
}

/* -------------------------------------------------------------------------
   ESCRITA
   ------------------------------------------------------------------------- */

/**
 * UUID v4. Mocks nunca usam índice de array como id — quando o Postgres
 * assumir, o tipo já é o mesmo.
 */
export function uuid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** ISO 8601 UTC — o único formato de data que a camada de dados usa. */
export function now(): string {
  return new Date().toISOString();
}
