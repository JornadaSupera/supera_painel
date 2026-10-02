import type { RecoveryCredential, RecoveryLinkType } from "@/services/contracts/operations";

/**
 * Reads the recovery link that Supabase sends to app accounts.
 *
 * The same screen has to accept every shape the e-mail template can produce:
 *
 *   ?token_hash=…&type=recovery        custom template (recommended)
 *   ?token=…&email=…                   custom template carrying the bare code
 *   ?token=…                           legacy, read as a hash for lack of an e-mail
 *   #access_token=…&refresh_token=…    default template, implicit flow
 *   #error_code=otp_expired&…          Supabase rejected the link upstream
 *
 * The same shapes carry the invitation a new staff member receives, with
 * `type=invite` in place of `type=recovery`. Both lead to the same screen —
 * choosing a password — and only the wording and the verification type differ.
 *
 * `?code=…` (PKCE) is refused on purpose: the verifier that completes it lives
 * in the app that asked for the e-mail, never in this browser.
 */

export type RecoveryLink =
  | { status: "ready"; credential: RecoveryCredential; purpose: RecoveryLinkType }
  | { status: "expired" }
  | { status: "invalid" };

/** The link types this screen consumes. Sign-up and magic links are somebody else's. */
const KNOWN_TYPES: readonly string[] = ["recovery", "invite"];

function linkType(params: URLSearchParams): RecoveryLinkType {
  return params.get("type") === "invite" ? "invite" : "recovery";
}

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
 * link and must not be diverted here. A staff invitation is ours.
 */
export function carriesRecoveryLink(location: { search: string; hash: string }): boolean {
  if (!location.search && !location.hash) return false;

  const params = readParams(location);

  const type = params.get("type");
  if (type && !KNOWN_TYPES.includes(type)) return false;

  return RECOVERY_KEYS.some((key) => params.has(key));
}

export function readRecoveryLink({ search, hash }: { search: string; hash: string }): RecoveryLink {
  const params = readParams({ search, hash });

  if (params.has("error") || params.has("error_code")) {
    return params.get("error_code") === "otp_expired" ? { status: "expired" } : { status: "invalid" };
  }

  const type = params.get("type");
  if (type && !KNOWN_TYPES.includes(type)) return { status: "invalid" };

  const purpose = linkType(params);

  const tokenHash = params.get("token_hash");
  if (tokenHash) {
    return {
      status: "ready",
      credential: { kind: "token_hash", token_hash: tokenHash, type: purpose },
      purpose,
    };
  }

  /* `token` is the bare code from `{{ .Token }}`, and the server can only look
     it up next to the address it was issued for — hence the e-mail travelling
     with it. Reading this as a `token_hash` is what made every link from such a
     template fail: the hash is derived from the code, so the code itself never
     matches the stored hash. */
  const token = params.get("token");
  const email = params.get("email");
  if (token && email) {
    return { status: "ready", credential: { kind: "otp", email, token, type: purpose }, purpose };
  }

  /* A `token` with no e-mail beside it. Older templates wrote the hash under
     this name, so it is still worth one attempt — as a hash, the only shape
     that can be verified without an address. */
  if (token) {
    return {
      status: "ready",
      credential: { kind: "token_hash", token_hash: token, type: purpose },
      purpose,
    };
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
      purpose,
    };
  }

  return { status: "invalid" };
}
