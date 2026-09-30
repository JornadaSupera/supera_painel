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

export const IS_DEV = raw.DEV;

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
 * Whether sign-in asks for the second factor at all.
 *
 * The contract requires it for administrators, so the default is on and stays
 * on in production. Off means the login never asks for a code — even for
 * someone who already enrolled an authenticator: enrolling works either way,
 * and turning the check on is a later, deliberate step.
 *
 * On, two things follow. Anyone with an authenticator enrolled is asked for a
 * code, whatever the profile. And an administrator without one may not operate
 * the panel: the frame stays closed and leads to the enrollment screen.
 * Professionals are never forced to have one.
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
  // There is one backend and no stand-in for it: without these two values the
  // panel has nothing to read, and saying so at boot beats an empty screen.
  if (!SUPABASE.url || !SUPABASE.anonKey) {
    throw new Error("[env] Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
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
