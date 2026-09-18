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

/** Everything the search string and the fragment carry, merged into one bag. */
function readParams({ search, hash }: { search: string; hash: string }): URLSearchParams {
  const params = new URLSearchParams(search);
  new URLSearchParams(hash.replace(/^#/, "")).forEach((value, key) => params.set(key, value));
  return params;
}

/**
 * Keys that only ever appear on a link the mail provider produced.
 *
 * The error ones are in the list on purpose: a spent or expired link still is
 * a recovery link, and the person who clicked it deserves the page that says
 * so rather than a sign-in form that explains nothing.
 */
const RECOVERY_KEYS = ["token_hash", "token", "access_token", "error_code", "error"] as const;

/**
 * Whether this URL carries a recovery link at all — however it turned out.
 *
 * Needed because the link does not necessarily land on the recovery page.
 * Supabase sends the person to whatever `redirect_to` the template asked for,
 * and falls back to the project's Site URL when that address is not in the
 * allow-list — so a recovery link routinely arrives at the panel's root. The
 * root redirects to the dashboard, a redirect drops the search and the
 * fragment, and the credential is destroyed on the way to a sign-in screen.
 *
 * `type` narrows it: a sign-up or magic-link confirmation is somebody else's
 * link and must not be diverted here.
 */
export function carriesRecoveryLink(location: { search: string; hash: string }): boolean {
  if (!location.search && !location.hash) return false;

  const params = readParams(location);

  const type = params.get("type");
  if (type && type !== "recovery") return false;

  return RECOVERY_KEYS.some((key) => params.has(key));
}

export function readRecoveryLink({ search, hash }: { search: string; hash: string }): RecoveryLink {
  const params = readParams({ search, hash });

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
