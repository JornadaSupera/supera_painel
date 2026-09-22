import type { ListParams } from "@/services/contracts";
import type { Periodo } from "./enums";

/**
 * TanStack Query keys — kept in one place.
 *
 * A key assembled by hand inside a component is the number one cause of ghost
 * cache and invalidation that never happens. Here the hierarchy is explicit:
 *
 *   queryKeys.patients.all       → invalidates everything about patients
 *   queryKeys.patients.lists()   → invalidates the listings only
 *   queryKeys.patients.list(p)   → one specific listing (filters included)
 *   queryKeys.patients.detail(id)
 */

/**
 * What a query key may carry.
 *
 * `unknown` used to stand here, and it let a `Date`, a `Map`, a class instance
 * or a function into a key. TanStack Query hashes keys with a deterministic
 * JSON walk: a `Date` hashes to `{}`, so two different windows would share one
 * cache entry, and a function hashes to nothing at all. Nothing passes those
 * today — which is exactly why the type should stop allowing it before someone
 * does, since the failure is a stale answer served as fresh, not an exception.
 */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * "An object whose every property survives the key hash."
 *
 * Written as a self-referencing constraint (`P extends QueryKeyParams<P>`)
 * because a plain index signature would reject every `interface` in the
 * project: interfaces have no index signature, and `DateRange` or
 * `FiltroClinico` would stop being valid keys for a reason that has nothing to
 * do with serialization.
 */
export type QueryKeyParams<T> = { [K in keyof T]: JsonValue | undefined };

function entity(name: string) {
  const all = [name] as const;

  return {
    all,
    lists: () => [...all, "list"] as const,
    list: (params?: ListParams) => [...all, "list", params ?? {}] as const,
    details: () => [...all, "detail"] as const,
    detail: (id: string) => [...all, "detail", id] as const,
  };
}

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    session: () => ["auth", "session"] as const,
  },

  dashboard: {
    all: ["dashboard"] as const,
    kpis: <R extends QueryKeyParams<R>>(period: Periodo, range?: R | null) => ["dashboard", "kpis", period, range ?? {}] as const,
    series: <R extends QueryKeyParams<R>>(name: string, period: Periodo, range?: R | null) =>
      ["dashboard", "series", name, period, range ?? {}] as const,
  },

  patients: entity("patients"),

  users: {
    ...entity("users"),
    accessLogs: (id: string) => ["users", "detail", id, "access-logs"] as const,
    /** Sob `users` de propósito: conceder um perfil encolhe esta lista. */
    contasSemPerfil: () => ["users", "accounts-without-profile"] as const,
  },

  contents: {
    ...entity("contents"),
    versions: (id: string) => ["contents", "detail", id, "versions"] as const,
  },

  permissions: {
    all: ["permissions"] as const,
    matrix: () => ["permissions", "matrix"] as const,
  },

  approvals: {
    all: ["approvals"] as const,
    queue: (params?: ListParams) => ["approvals", "queue", params ?? {}] as const,
    diff: (id: string, version: number) => ["approvals", "diff", id, version] as const,
  },

  reports: {
    all: ["reports"] as const,
    definitions: () => ["reports", "definitions"] as const,
    run: <P extends QueryKeyParams<P>>(slug: string, params?: P | null) => ["reports", "run", slug, params ?? {}] as const,
    schedules: () => ["reports", "schedules"] as const,
  },

  statistics: {
    all: ["statistics"] as const,
    clinical: <P extends QueryKeyParams<P>>(params?: P | null) => ["statistics", "clinical", params ?? {}] as const,
    operational: <P extends QueryKeyParams<P>>(params?: P | null) => ["statistics", "operational", params ?? {}] as const,
  },

  audit: {
    ...entity("audit"),
    summary: <R extends QueryKeyParams<R>>(range?: R | null) => ["audit", "summary", range ?? {}] as const,
    /**
     * Opções dos seletores. A chave leva só a JANELA, e não os filtros: as
     * opções descrevem o período inteiro, então trocar de filtro não deve
     * invalidá-las nem disparar leitura nova.
     */
    facets: <R extends QueryKeyParams<R>>(range?: R | null) => ["audit", "facets", range ?? {}] as const,
  },

  settings: {
    all: ["settings"] as const,
    get: () => ["settings", "get"] as const,
    terms: () => ["settings", "terms"] as const,
    /** Um limiar por sintoma. Publicar termo não invalida isto, nem o contrário. */
    alertRules: () => ["settings", "alert-rules"] as const,
    reasons: () => ["settings", "reasons"] as const,
  },

  catalogs: {
    all: ["catalogs"] as const,
    cids: () => ["catalogs", "cids"] as const,
    protocols: () => ["catalogs", "protocols"] as const,
    specialties: () => ["catalogs", "specialties"] as const,
    effects: () => ["catalogs", "effects"] as const,
    phases: () => ["catalogs", "phases"] as const,
  },
} as const;

export default queryKeys;
