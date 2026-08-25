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
    kpis: (period: Periodo, range?: unknown) => ["dashboard", "kpis", period, range ?? {}] as const,
    series: (name: string, period: Periodo, range?: unknown) =>
      ["dashboard", "series", name, period, range ?? {}] as const,
  },

  patients: entity("patients"),

  users: {
    ...entity("users"),
    accessLogs: (id: string) => ["users", "detail", id, "access-logs"] as const,
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
    run: (slug: string, params?: unknown) => ["reports", "run", slug, params ?? {}] as const,
    schedules: () => ["reports", "schedules"] as const,
  },

  statistics: {
    all: ["statistics"] as const,
    clinical: (params?: unknown) => ["statistics", "clinical", params ?? {}] as const,
    operational: (params?: unknown) => ["statistics", "operational", params ?? {}] as const,
  },

  audit: {
    ...entity("audit"),
    summary: (range?: unknown) => ["audit", "summary", range ?? {}] as const,
  },

  settings: {
    all: ["settings"] as const,
    get: () => ["settings", "get"] as const,
    terms: () => ["settings", "terms"] as const,
  },

  catalogs: {
    all: ["catalogs"] as const,
    cids: () => ["catalogs", "cids"] as const,
    protocols: () => ["catalogs", "protocols"] as const,
    specialties: () => ["catalogs", "specialties"] as const,
    effects: () => ["catalogs", "effects"] as const,
  },
} as const;

export default queryKeys;
