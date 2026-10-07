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
    /** Nível de garantia da sessão contra a exigência do backend. */
    assurance: () => ["auth", "assurance"] as const,
    /** O autenticador da própria conta — ver `useSegundoFator`. */
    secondFactor: () => ["auth", "second-factor"] as const,
  },

  dashboard: {
    all: ["dashboard"] as const,
    kpis: <R extends QueryKeyParams<R>>(period: Periodo, range?: R | null) => ["dashboard", "kpis", period, range ?? {}] as const,
    series: <R extends QueryKeyParams<R>>(name: string, period: Periodo, range?: R | null) =>
      ["dashboard", "series", name, period, range ?? {}] as const,
  },

  patients: {
    ...entity("patients"),
    /** Quem acompanha o paciente — vínculos vigentes e revogados. */
    caregivers: (id: string) => ["patients", "detail", id, "caregivers"] as const,
  },

  users: {
    ...entity("users"),
    accessLogs: (id: string) => ["users", "detail", id, "access-logs"] as const,
    /** Concessões individuais do backend — outro eixo que `permissions.matrix`. */
    restrictedPermissions: (id: string) => ["users", "detail", id, "restricted"] as const,
    /** Sob `users` de propósito: conceder um perfil encolhe esta lista. */
    contasSemPerfil: () => ["users", "accounts-without-profile"] as const,
  },

  contents: {
    ...entity("contents"),
    versions: (id: string) => ["contents", "detail", id, "versions"] as const,
    /** As do próprio autor. Sob `contents`: enviar para revisão mexe na fila do administrador. */
    mine: (params?: ListParams) => ["contents", "mine", params ?? {}] as const,
    categories: () => ["contents", "categories"] as const,
    /** Fora de `contents.all`: o anexo não muda, e invalidar a lista não deve baixá-lo de novo. */
    attachment: (caminho: string) => ["content-attachment", caminho] as const,
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
    runs: () => ["reports", "runs"] as const,
    /** One generation, opened from a "report ready" notification. */
    execution: (id: string) => ["reports", "runs", id] as const,
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
    security: () => ["settings", "security"] as const,
    /** Fila de conferência da integração — só os vínculos ainda propostos. */
    externalLinks: () => ["settings", "external-links"] as const,
    consents: () => ["settings", "consents"] as const,
    dataSubjectRequests: () => ["settings", "data-subject-requests"] as const,
    /** Identidade visual, mensagens e horário — `clinic_settings`. */
    clinic: () => ["settings", "clinic"] as const,
    /** Metas e capacidade do gráfico de volume — `operational_parameters`. */
    operationalTargets: () => ["settings", "operational-targets"] as const,
  },

  /** Painel clínico — ver PA-07. Recortado pela sessão; sem parâmetro de "quem sou eu" na chave. */
  notifications: {
    all: ["notifications"] as const,
    list: () => ["notifications", "list"] as const,
    unread: () => ["notifications", "unread"] as const,
    /** The newest unread ones, read only when the count goes up: what is new, to announce. */
    unreadList: () => ["notifications", "unread-list"] as const,
    /** The admin's pending queues, counted. */
    pending: () => ["notifications", "pending"] as const,
    /**
     * The names in the open inbox. Outside `notifications.all` on purpose:
     * marking one as read refreshes the inbox, and must not read the names
     * again — each one is a line on the audit trail.
     */
    patientNames: (ids: readonly string[]) => ["notification-patient-names", ...ids] as const,
    /** Every set of names already read — where a toast looks, never asking for one. */
    patientNamesAll: () => ["notification-patient-names"] as const,
  },
  clinico: {
    all: ["clinico"] as const,
    agenda: <R extends QueryKeyParams<R>>(range?: R | null) => ["clinico", "agenda", range ?? {}] as const,
    /** Every window of the agenda: what booking, moving or closing an appointment must refresh. */
    agendaAll: () => ["clinico", "agenda"] as const,
    /** Whether this professional manages the schedule — asked once, it does not change in a session. */
    schedulingAccess: () => ["clinico", "scheduling-access"] as const,
    /** When people on the team cannot take appointments, in a window. */
    busyIn: (from: string, to: string) => ["clinico", "busy", from, to] as const,
    /** Every window of busy times — they come from personal blocks: what saving one must refresh. */
    busyAll: () => ["clinico", "busy"] as const,
    /** Sem status = a fila inteira; `undefined` vira `"todos"`, para a chave não colidir com "sem filtro nenhum". */
    alertas: (status?: string) => ["clinico", "alertas", status ?? "todos"] as const,
    /** Every reading of the alert queue, by status or not: what opening one alert must refresh. */
    alertasAll: () => ["clinico", "alertas"] as const,
    conversas: () => ["clinico", "conversas"] as const,
    /** Average minutes to the first reply over the last N days. */
    tempoDeResposta: (dias: number) => ["clinico", "tempo-de-resposta", dias] as const,
    /** The signed-in professional's own numbers between two instants. */
    desempenho: (de: string, ate: string) => ["clinico", "desempenho", de, ate] as const,
    perfil: () => ["clinico", "perfil"] as const,
    mensagens: (conversaId: string) => ["clinico", "conversas", conversaId, "mensagens"] as const,
    /** Fora de `clinico.all` de propósito: o anexo não muda, e invalidar a fila não deve baixá-lo de novo. */
    anexo: (caminho: string) => ["clinico-anexo", caminho] as const,
    /** Opening hours of the clinic and the kinds of appointment: they change rarely. */
    businessHours: () => ["clinico", "business-hours"] as const,
    appointmentTypes: () => ["clinico", "appointment-types"] as const,
    /** Every window of personal blocks: what saving or removing one must refresh. */
    blocks: () => ["clinico", "blocks"] as const,
    blocksIn: (from: string, to: string) => ["clinico", "blocks", from, to] as const,
    /** Colleagues a conversation can be handed to. */
    transferTargets: () => ["clinico", "transfer-targets"] as const,
    /** Who held a conversation, and when. */
    assignments: (conversationId: string) =>
      ["clinico", "conversas", conversationId, "assignments"] as const,
    /** Every patient record on screen — what a new note or flag must refresh, and nothing else. */
    records: () => ["clinico", "record"] as const,
    /** One patient's timeline. `days: null` is the whole history, so it gets its own key. */
    record: (patientId: string, days: number | null) =>
      ["clinico", "record", patientId, days ?? "all"] as const,
    /** Symptoms of one diary entry. Immutable once saved. */
    diarySymptoms: (entryId: string) => ["clinico", "diary", entryId, "symptoms"] as const,
    /** One patient's diary, as a list. */
    patientDiary: (patientId: string) => ["clinico", "patient-diary", patientId] as const,
    /** Distress flags on one patient — under `records()`, so raising one refreshes them. */
    distressFlags: (patientId: string) => ["clinico", "record", "flags", patientId] as const,
    /**
     * One patient's appointments still to come. Under the agenda prefix on purpose:
     * booking, moving or closing an appointment refreshes it with the agenda.
     */
    patientAgenda: (patientId: string) => ["clinico", "agenda", "patient", patientId] as const,
    /** Orientations sent straight to one patient. */
    directedSends: (patientId: string) => ["clinico", "directed-sends", patientId] as const,
    /** The published orientations one area can send. */
    sendableContent: (specialty: string) => ["clinico", "sendable-content", specialty] as const,
  },

  /** Satisfação dos pacientes — a pesquisa NPS. */
  satisfaction: {
    all: ["satisfaction"] as const,
    summary: (days: number | null) => ["satisfaction", "summary", days ?? "all"] as const,
    list: <P extends QueryKeyParams<P>>(params: P) => ["satisfaction", "list", params] as const,
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
