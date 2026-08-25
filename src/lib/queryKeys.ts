import type { ListParams } from "@/services/contracts";
import type { Periodo } from "./enums";

/**
 * Chaves do TanStack Query — centralizadas.
 *
 * Chave montada à mão dentro de componente é a causa nº 1 de cache fantasma e
 * invalidação que não acontece. Aqui a hierarquia é explícita:
 *
 *   queryKeys.pacientes.all       → invalida tudo de pacientes
 *   queryKeys.pacientes.lists()   → invalida só as listagens
 *   queryKeys.pacientes.list(p)   → uma listagem específica (filtros inclusos)
 *   queryKeys.pacientes.detail(id)
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
    kpis: (periodo: Periodo, range?: unknown) => ["dashboard", "kpis", periodo, range ?? {}] as const,
    series: (nome: string, periodo: Periodo, range?: unknown) =>
      ["dashboard", "series", nome, periodo, range ?? {}] as const,
  },

  pacientes: entity("pacientes"),

  usuarios: {
    ...entity("usuarios"),
    accessLogs: (id: string) => ["usuarios", "detail", id, "access-logs"] as const,
  },

  conteudos: {
    ...entity("conteudos"),
    versions: (id: string) => ["conteudos", "detail", id, "versions"] as const,
  },

  permissoes: {
    all: ["permissoes"] as const,
    matrix: () => ["permissoes", "matrix"] as const,
  },

  aprovacoes: {
    all: ["aprovacoes"] as const,
    queue: (params?: ListParams) => ["aprovacoes", "queue", params ?? {}] as const,
    diff: (id: string, versao: number) => ["aprovacoes", "diff", id, versao] as const,
  },

  relatorios: {
    all: ["relatorios"] as const,
    definitions: () => ["relatorios", "definitions"] as const,
    run: (slug: string, params?: unknown) => ["relatorios", "run", slug, params ?? {}] as const,
    schedules: () => ["relatorios", "schedules"] as const,
  },

  estatisticas: {
    all: ["estatisticas"] as const,
    clinicas: (params?: unknown) => ["estatisticas", "clinicas", params ?? {}] as const,
    operacionais: (params?: unknown) => ["estatisticas", "operacionais", params ?? {}] as const,
  },

  auditoria: {
    ...entity("auditoria"),
    summary: (range?: unknown) => ["auditoria", "summary", range ?? {}] as const,
  },

  configuracoes: {
    all: ["configuracoes"] as const,
    get: () => ["configuracoes", "get"] as const,
    termos: () => ["configuracoes", "termos"] as const,
  },

  catalogos: {
    all: ["catalogos"] as const,
    cids: () => ["catalogos", "cids"] as const,
    protocolos: () => ["catalogos", "protocolos"] as const,
    especialidades: () => ["catalogos", "especialidades"] as const,
    efeitos: () => ["catalogos", "efeitos"] as const,
  },
} as const;

export default queryKeys;
