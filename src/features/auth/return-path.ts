import type { Location } from "react-router-dom";

/**
 * Where to send someone once they are signed in: the address they were turned
 * away from, or `null` when they came to sign in on purpose.
 *
 * The whole address, not just its path. A report link is
 * `/relatorios/faltas?dias=90`: bringing the person to `/relatorios/faltas`
 * would open the right report on the wrong period, and nothing on screen would
 * say the link had been changed on the way.
 *
 * It reads router state, which the app itself wrote in `ProtectedRoute` — never
 * a value from the address bar, so it is not an open redirect.
 */
export function returnPath(state: unknown): string | null {
  const from = (state as { from?: Location } | null)?.from;
  return from ? `${from.pathname}${from.search}${from.hash}` : null;
}
