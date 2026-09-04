/**
 * Single entry point for environment variables.
 *
 * No other file reads `import.meta.env` directly. That gives us one place to
 * validate configuration, an explicit failure at boot instead of a silent
 * `undefined` in production, and a clear inventory of what the front-end knows
 * — useful during a security audit.
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

/** Backend simulation — only has an effect in mock mode. */
export const MOCK = {
  delayMin: num(raw.VITE_MOCK_DELAY_MIN, 300),
  delayMax: num(raw.VITE_MOCK_DELAY_MAX, 800),
  /** 0 to 100. Above 0, a share of the calls fails on purpose. */
  errorRate: num(raw.VITE_MOCK_ERROR_RATE, 0),
} as const;

/**
 * Supabase.
 * The `anon` key is public by design — the real protection is row level
 * security in Postgres. `service_role` must NEVER exist in the front-end.
 */
export const SUPABASE = {
  url: raw.VITE_SUPABASE_URL ?? "",
  anonKey: raw.VITE_SUPABASE_ANON_KEY ?? "",
} as const;

/**
 * Session — idle timeout.
 *
 * `idleMinutes: 0` switches the expiry clock off entirely: no idle logout and
 * no deadline logout. It exists for development, where being signed out in the
 * middle of building a screen costs more than it protects.
 *
 * Production keeps it on. An unattended panel showing patient data is exactly
 * what the timeout is for, and a reception desk is the place it happens.
 */
export const SESSION = {
  idleMinutes: num(raw.VITE_SESSION_IDLE_MINUTES, 15),
  warnMinutes: num(raw.VITE_SESSION_WARN_MINUTES, 2),
} as const;

/**
 * Whether the panel demands a second factor to sign in.
 *
 * The contract requires it for administrators, so the default is on and stays
 * on in production. The switch exists because the panel has no screen for
 * enrolling an authenticator yet: with it forced on and no factor registered,
 * an account that is otherwise valid cannot get in at all.
 *
 * Turning it off is a deliberate, visible choice in configuration — which is
 * the point. The previous behaviour skipped the factor whenever the build was
 * a development one, and a security control that switches itself off based on
 * how the code was compiled is a control nobody can audit.
 */
export const MFA_REQUIRED = raw.VITE_MFA_OBRIGATORIO !== "false";

/** Whether the session expires on its own at all. */
export const SESSION_EXPIRES = SESSION.idleMinutes > 0;

/**
 * Boot-time validation, called once from `main.tsx`.
 * Fails loud and early instead of breaking halfway through a clinical screen.
 */
export function assertEnv(): void {
  if (API_MODE === "supabase" && (!SUPABASE.url || !SUPABASE.anonKey)) {
    throw new Error(
      "[env] VITE_API_MODE=supabase exige VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.",
    );
  }

  // Guard against the most expensive mistake available: leaking the service
  // key. Anything prefixed with VITE_ ends up in the public bundle.
  const forbidden = Object.keys(raw).filter((key) =>
    /SERVICE_ROLE|SECRET|PRIVATE_KEY/i.test(key),
  );

  if (forbidden.length > 0) {
    throw new Error(
      `[env] Variável sensível exposta ao browser: ${forbidden.join(", ")}. ` +
        "Remova do .env — tudo que começa com VITE_ vai para o bundle público.",
    );
  }
}
