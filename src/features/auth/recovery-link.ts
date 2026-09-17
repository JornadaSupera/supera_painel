import type { RecoveryCredential } from "@/services/contracts/operations";

/**
 * Reads the recovery link that Supabase sends to app accounts.
 *
 * The same screen has to accept every shape the e-mail template can produce:
 *
 *   ?token_hash=…&type=recovery        custom template (recommended)
 *   ?token=…                           the panel's own template
 *   #access_token=…&refresh_token=…    default template, implicit flow
 *   #error_code=otp_expired&…          Supabase rejected the link upstream
 *
 * `?code=…` (PKCE) is refused on purpose: the verifier that completes it lives
 * in the app that asked for the e-mail, never in this browser.
 */

export type RecoveryLink =
  | { status: "ready"; credential: RecoveryCredential }
  | { status: "expired" }
  | { status: "invalid" };

export function readRecoveryLink({ search, hash }: { search: string; hash: string }): RecoveryLink {
  const params = new URLSearchParams(search);
  new URLSearchParams(hash.replace(/^#/, "")).forEach((value, key) => params.set(key, value));

  if (params.has("error") || params.has("error_code")) {
    return params.get("error_code") === "otp_expired" ? { status: "expired" } : { status: "invalid" };
  }

  const type = params.get("type");
  if (type && type !== "recovery") return { status: "invalid" };

  const tokenHash = params.get("token_hash") ?? params.get("token");
  if (tokenHash) {
    return { status: "ready", credential: { kind: "token_hash", token_hash: tokenHash } };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const expiresAt = Number(params.get("expires_at"));
    if (Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt * 1000 <= Date.now()) {
      return { status: "expired" };
    }

    return {
      status: "ready",
      credential: { kind: "session", access_token: accessToken, refresh_token: refreshToken },
    };
  }

  return { status: "invalid" };
}
