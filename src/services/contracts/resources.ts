/**
 * SUPERFÍCIE DA API
 * =============================================================================
 * Inventário de todos os recursos e operações que a camada de dados expõe.
 *
 *  1. Contrato — mock e Supabase implementam exatamente estas chaves.
 *  2. Checklist — o que ainda não foi implementado falha com NOT_IMPLEMENTED,
 *     nunca com `undefined is not a function`.
 *  3. Rastreabilidade — cada recurso aponta para a fase do plano e para a
 *     futura tabela no Postgres.
 *
 * `table` = nome da tabela no Supabase (Fase 15). Manter em sincronia com as
 * migrações SQL versionadas.
 */

export interface ResourceDefinition {
  /** `null` quando a operação não é uma tabela (auth, RPC, view). */
  table: string | null;
  /** Fase do plano de execução em que será implementado. */
  fase: number;
  operations: readonly string[];
}

export const RESOURCES = {
  auth: {
    table: null, // usa supabase.auth
    fase: 2,
    operations: [
      "signIn",
      "verifyMfa",
      "signOut",
      "getSession",
      "requestPasswordReset",
      "resetPassword",
    ],
  },
  dashboard: {
    table: "vw_dashboard_metricas",
    fase: 4,
    operations: ["getKpis", "getSeries"],
  },
  pacientes: {
    table: "pacientes",
    fase: 5,
    operations: ["list", "getById", "create", "update", "deactivate", "sendInvite", "export"],
  },
  usuarios: {
    table: "usuarios",
    fase: 6,
    operations: [
      "list",
      "getById",
      "create",
      "update",
      "setStatus",
      "resetPassword",
      "setMfa",
      "listAccessLogs",
    ],
  },
  permissoes: {
    table: "permissoes",
    fase: 6,
    operations: ["getMatrix", "updateMatrix"],
  },
  conteudos: {
    table: "conteudos",
    fase: 7,
    operations: [
      "list",
      "getById",
      "create",
      "update",
      "publish",
      "unpublish",
      "listVersions",
      "submitForReview",
    ],
  },
  aprovacoes: {
    table: "conteudo_revisoes",
    fase: 11, // MÉDIO
    operations: ["listQueue", "getDiff", "approve", "requestChanges", "reject"],
  },
  relatorios: {
    table: null, // agregações via RPC/views
    fase: 8,
    operations: ["listDefinitions", "run", "export", "schedule", "listSchedules", "createShareLink"],
  },
  estatisticasClinicas: {
    table: null,
    fase: 12, // MÉDIO
    operations: ["crossTab", "heatmap", "compareProtocolos"],
  },
  estatisticasOperacionais: {
    table: null,
    fase: 13, // MÉDIO
    operations: [
      "getIndicadores",
      "getTempoResposta",
      "getAdesaoAgenda",
      "getFilaAlertas",
      "getGargalos",
    ],
  },
  auditoria: {
    table: "auditoria_logs",
    fase: 10, // MÉDIO
    operations: ["list", "getSummary", "getById", "export"],
  },
  configuracoes: {
    table: "configuracoes",
    fase: 9,
    operations: ["get", "update", "uploadLogo", "getTermos", "publishTermos"],
  },
  catalogos: {
    table: "catalogos",
    fase: 5,
    operations: ["listCids", "listProtocolos", "listEspecialidades", "listEfeitos"],
  },
} as const satisfies Record<string, ResourceDefinition>;

export type Resources = typeof RESOURCES;
export type ResourceName = keyof Resources;

/**
 * Forma de um adapter, derivada do inventário acima.
 *
 * Isto é o que torna a promessa da troca de backend verificável: um adapter a
 * que falte uma operação **não compila**. A garantia deixa de depender de
 * disciplina.
 */
export type Adapter = {
  [R in ResourceName]: {
    [O in Resources[R]["operations"][number]]: (
      ...args: never[]
    ) => Promise<unknown>;
  };
};

/** Lista plana `["pacientes.list", "usuarios.create", ...]`. */
export function listOperations(): string[] {
  return Object.entries(RESOURCES).flatMap(([resource, def]) =>
    def.operations.map((operation) => `${resource}.${operation}`),
  );
}
