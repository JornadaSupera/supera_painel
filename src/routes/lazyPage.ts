import { lazy, type ComponentType } from "react";

/**
 * `lazy()` for a route screen that survives a deploy.
 *
 * Each screen is its own file, named after a hash of its contents. A deploy
 * replaces those files, and a panel opened before it still asks for the old
 * names: hosting answers with the panel's HTML, the browser refuses it as code,
 * and the screen did not open — blank until F5, which loads the new names. So
 * a failed load reloads the page once, landing on the same address with the
 * new version.
 *
 * Once only: if the screen still fails right after a reload, the cause is not a
 * stale version, and reloading again would loop. The error then goes on to the
 * screen's error boundary. Being offline is not a stale version either.
 */

/** Session-only mark of the last reload: a timestamp, nothing about the person. */
const RELOAD_MARK = "supera:reloaded-for-new-version";

/** A reload this recent means reloading did not fix it. */
const LOOP_WINDOW_MS = 10_000;

function reloadOnce(): boolean {
  if (!navigator.onLine) return false;

  try {
    const last = Number(sessionStorage.getItem(RELOAD_MARK) ?? 0);
    if (Date.now() - last < LOOP_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_MARK, String(Date.now()));
  } catch {
    // Without storage there is no telling a loop apart: show the error.
    return false;
  }

  window.location.reload();
  return true;
}

export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch((error: unknown) => {
      // The page is going away: hold the loading state until it does.
      if (reloadOnce()) return new Promise<never>(() => {});
      throw error;
    }),
  );
}
