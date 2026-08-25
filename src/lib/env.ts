/**
 * Acesso centralizado às variáveis de ambiente.
 *
 * Nenhum outro arquivo lê `import.meta.env` diretamente. Isso garante um único
 * lugar para validar configuração, falha explícita no boot em vez de
 * `undefined` silencioso em produção, e inventário claro do que o front-end
 * conhece — útil em auditoria de segurança.
 */

const raw = import.meta.env;

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type ApiMode = "mock" | "supabase";

export const API_MODE: ApiMode = raw.VITE_API_MODE === "supabase" ? "supabase" : "mock";

export const IS_MOCK = API_MODE === "mock";
export const IS_DEV = raw.DEV;

/** Simulação de backend — só tem efeito em modo mock. */
export const MOCK = {
  delayMin: num(raw.VITE_MOCK_DELAY_MIN, 300),
  delayMax: num(raw.VITE_MOCK_DELAY_MAX, 800),
  /** 0 a 100. Acima de 0, parte das chamadas falha de propósito. */
  errorRate: num(raw.VITE_MOCK_ERROR_RATE, 0),
} as const;

/**
 * Supabase (Fase 15).
 * A chave `anon` é pública por design — a proteção real é a RLS no Postgres.
 * A `service_role` NUNCA pode existir no front-end.
 */
export const SUPABASE = {
  url: raw.VITE_SUPABASE_URL ?? "",
  anonKey: raw.VITE_SUPABASE_ANON_KEY ?? "",
} as const;

/** Sessão — expiração por inatividade. */
export const SESSION = {
  idleMinutes: num(raw.VITE_SESSION_IDLE_MINUTES, 15),
  warnMinutes: num(raw.VITE_SESSION_WARN_MINUTES, 2),
} as const;

/**
 * Validação de boot, chamada uma vez em `main.tsx`.
 * Falha alto e cedo, em vez de quebrar no meio de uma tela clínica.
 */
export function assertEnv(): void {
  if (API_MODE === "supabase" && (!SUPABASE.url || !SUPABASE.anonKey)) {
    throw new Error(
      "[env] VITE_API_MODE=supabase exige VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }

  // Barreira contra o erro mais caro possível: vazar a chave de serviço.
  // Tudo com prefixo VITE_ vai para o bundle público.
  const proibidas = Object.keys(raw).filter((chave) =>
    /SERVICE_ROLE|SECRET|PRIVATE_KEY/i.test(chave),
  );

  if (proibidas.length > 0) {
    throw new Error(
      `[env] Variável sensível exposta ao browser: ${proibidas.join(", ")}. ` +
        "Remova do .env — tudo que começa com VITE_ vai para o bundle público.",
    );
  }
}
