import { createContext, useContext } from "react";

/**
 * SESSION COUNTDOWN — a context of its own, and the split is the point.
 * =============================================================================
 * The idle clock ticks every fifteen seconds. While it lived on
 * `AuthContext`, every tick produced a new context value, and **every**
 * consumer of authentication rerendered with it: the route guards, every
 * `<Can>` in the tree, the sidebar, the topbar. None of them read the
 * countdown.
 *
 * Only the expiry warning does, so only it subscribes here. The permission
 * side of the context now changes when permissions change, which is what a
 * consumer of `useAuth()` expects.
 */

export interface SessionClockValue {
  /** Seconds left until the automatic logout; `null` without a session. */
  secondsUntilExpiry: number | null;
  /** True when little time is left and the warning should appear. */
  isExpiringSoon: boolean;
}

const EMPTY: SessionClockValue = { secondsUntilExpiry: null, isExpiringSoon: false };

/**
 * Defaults to "no session, no warning" instead of `null`.
 *
 * A missing provider here is not a programming error the way a missing
 * `AuthProvider` is: with the clock switched off by configuration there is
 * genuinely nothing to count, and the warning simply never appears.
 */
export const SessionClockContext = createContext<SessionClockValue>(EMPTY);

export function useSessionClock(): SessionClockValue {
  return useContext(SessionClockContext);
}
