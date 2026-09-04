import type { DateRange, FilterValue, ListParams, ListResult, Sort } from "@/services/contracts";
import { normalizeListParams, ok } from "@/services/contracts";

/**
 * IN-MEMORY LIST PIPELINE — search, filter, range, sort, paginate.
 * =============================================================================
 * Shared by both adapters, for two different reasons.
 *
 * The mock uses it because it has nothing but arrays.
 *
 * The Supabase adapter uses it because some reads arrive through `read_*`
 * functions that take only `p_limit`/`p_offset` — no search, no filter, no
 * sort, and no total count. Whatever the screen asks beyond that has to be
 * resolved over the window the function returned. Keeping one implementation
 * means the two adapters cannot drift into answering the same question
 * differently.
 *
 * The semantics mirror PostgREST on purpose: array filter behaves like `.in()`,
 * single value like `.eq()`, search like `.or(...ilike)`. Wherever the backend
 * grows a real filter, moving it server-side changes no result.
 */

/** A generic row. The helpers walk string paths, so they need no shape. */
type Row = object;

/** Strips accents and case — tolerant search, like `unaccent` in Postgres. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Text search across several fields — equivalent to `.or(...ilike)`. */
export function matchSearch(row: unknown, search: string, fields: string[]): boolean {
  if (!search) return true;

  const needle = normalizeText(search);
  return fields.some((field) => normalizeText(getPath(row, field)).includes(needle));
}

/**
 * Equality filters. An array behaves like `.in()`, a single value like `.eq()`.
 * Empty values (`""`, `null`, `undefined`, `"todos"`) are ignored.
 */
export function matchFilters(row: unknown, filters: Record<string, FilterValue> = {}): boolean {
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

/** Time window — equivalent to `.gte(field, from).lte(field, to)`. */
export function matchRange(row: unknown, range: DateRange | null, field = "criado_em"): boolean {
  if (!range?.from || !range?.to) return true;

  const value = new Date(String(getPath(row, field))).getTime();
  return value >= new Date(range.from).getTime() && value <= new Date(range.to).getTime();
}

/** Stable sort, pt-BR `localeCompare`, nulls last. */
export function applySort<T extends Row>(rows: T[], sort: Sort | null): T[] {
  if (!sort?.field) return rows;

  const dir = sort.direction === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const av = getPath(a, sort.field);
    const bv = getPath(b, sort.field);

    if (av === bv) return 0;
    // Nulls last, the way Postgres orders by default.
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;

    if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;

    const ad = Date.parse(String(av));
    const bd = Date.parse(String(bv));
    if (!Number.isNaN(ad) && !Number.isNaN(bd)) return (ad - bd) * dir;

    return String(av).localeCompare(String(bv), "pt-BR", { numeric: true }) * dir;
  });
}

/** Supports a nested path: `getPath(row, "paciente.nome")`. */
export function getPath(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, key) => (acc == null ? acc : (acc as Record<string, unknown>)[key]), obj);
}

export interface PaginateOptions {
  searchFields?: string[];
  rangeField?: string;
}

/**
 * Applies search, filters, range, sort and pagination, returning a contract
 * `ListResult`. Every in-memory `list()` goes through here.
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
