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
    operations: [
      "list",
      "getById",
      "create",
      "update",
      "deactivate",
      "sendInvite",
      "export",
      /**
       * Devolve CPF, telefone ou e-mail COMPLETOS de um paciente.
       *
       * Existe como operação própria, e não como campo da listagem, porque é a
       * única forma de a revelação ser auditável de fato: enquanto o dado
       * completo não sai do banco, não há o que vazar no DevTools nem no cache
       * do navegador. Na Fase 15 vira uma função `security definer` que checa a
       * permissão e grava o acesso antes de responder.
       */
      "revealPii",
    ],
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
      /**
       * Contagem por especialidade, que é o que a faixa do topo da tela mostra.
       * Agregação é do banco (`group by`), não da tela: a tela só tem a página
       * atual, e somar em cima dela daria número errado assim que a lista
       * crescer.
       */
      "getDistribuicao",
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
