import { MOCK } from "@/lib/env";
import { ERROR_CODE, fail } from "@/services/contracts";

/**
 * Infra compartilhada dos mocks.
 *
 * Reproduz o comportamento de um backend real — latência, paginação,
 * ordenação, busca e falha ocasional — para que os estados de Loading, Vazio e
 * Erro sejam exercitados de verdade durante o desenvolvimento, e não apenas
 * "no papel".
 *
 * Busca, filtro, ordenação e paginação moram em `../_list`: o adapter Supabase
 * precisa exatamente das mesmas regras para resolver o que as funções `read_*`
 * não resolvem, e duas cópias da mesma regra é como as duas passam a discordar.
 */

export {
  applySort,
  getPath,
  matchFilters,
  matchRange,
  matchSearch,
  normalizeText,
  paginate,
  type PaginateOptions,
} from "../_list";

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
