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
      "completePasswordRecovery",
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
      /**
       * Contas que ainda não têm perfil no painel.
       *
       * O cadastro de profissional é uma CONCESSÃO sobre conta existente, não a
       * criação de um acesso: quem cria a conta é a própria pessoa, e o painel
       * não tem servidor para criá-la em nome de ninguém. Esta operação é o que
       * alimenta o seletor de quem pode receber o perfil.
       */
      "listContasSemPerfil",
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
    /**
     * `getFacets` devolve quem aparece na janela — é o que preenche os
     * seletores de usuário e de paciente sem consultar os cadastros, e portanto
     * sem gerar um acesso a prontuário só para desenhar um filtro.
     */
    operations: ["list", "getSummary", "getFacets", "getById", "export"],
  },
  configuracoes: {
    table: "configuracoes",
    fase: 9,
    /**
     * `get` e `update` são o VOCABULÁRIO — somente leitura, por decisão de
     * produto. O resto é a OPERAÇÃO da clínica, que ela mesma mantém: o
     * documento legal em vigor, o grau que dispara alerta e os motivos de
     * falta. Ver `types/configuracao.ts` para por que a linha passa aí.
     */
    operations: [
      "get",
      "update",
      "uploadLogo",
      "getTermos",
      "publishTermos",
      "getRegrasAlerta",
      "setRegraAlerta",
      "removerRegraAlerta",
      "getMotivos",
      "criarMotivo",
      "atualizarMotivo",
      "setMotivoAtivo",
    ],
  },
  catalogos: {
    table: "catalogos",
    fase: 5,
    /**
     * `listFases` devolve as fases que o cadastro tem ATIVAS.
     *
     * O painel conhece cinco fases e o catálogo do banco raramente tem as
     * cinco. Oferecer as que faltam produz um filtro que só sabe devolver
     * lista vazia, e quem filtra conclui que a clínica não tem paciente
     * naquela fase — em vez de saber que a fase não existe no cadastro.
     */
    operations: ["listCids", "listProtocolos", "listEspecialidades", "listEfeitos", "listFases"],
  },
} as const satisfies Record<string, ResourceDefinition>;

export type Resources = typeof RESOURCES;
export type ResourceName = keyof Resources;

/**
 * Forma de um adapter, derivada do inventário acima.
 *
 * Garante a **superfície**: o nome de cada operação existe nos dois adapters.
 * Não garante a assinatura — `(...args: never[]) => Promise<unknown>` aceita
 * qualquer coisa, porque o inventário é percorrido em runtime e o tipo derivado
 * dele é necessariamente genérico.
 *
 * A assinatura é verificada em outro lugar, e é bom saber onde antes de confiar
 * nesta: `PartialAdapterModules`, em `contracts/operations.ts`, aplicado com
 * `satisfies` no bloco `implemented` de cada adapter. É ele que faz um adapter
 * com parâmetro ou retorno divergente **não compilar** — esta declaração
 * sozinha deixaria passar.
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
