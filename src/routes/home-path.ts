import { PAPEL } from "@/lib/enums";
import type { UsuarioAutenticado } from "@/types/auth";

/**
 * The two panels this app serves. Each account belongs to exactly one: the
 * administration is for administrators, a clinical area is for the
 * professional of that specialty. Neither opens the other's screens.
 */
export type PanelArea = "admin" | "clinico";

/**
 * Which panel an account belongs to, or `null` when it belongs to none — a
 * professional with no specialty has no clinical area to work in, and is not
 * an administrator either.
 */
export function panelAreaOf(user: UsuarioAutenticado | null): PanelArea | null {
  if (user?.papel === PAPEL.ADMIN) return "admin";
  if (user?.papel === PAPEL.PROFISSIONAL && user.especialidade) return "clinico";
  return null;
}

/**
 * Where an authenticated person belongs by default.
 *
 * A professional's home is their own clinical area, not the administrative
 * dashboard. Shared by every place that decides a post-auth destination
 * (`LoginPage`, `MfaPage`, `HomeRedirect`, `AreaRoute`) so they never drift
 * into disagreeing about it, the way `/login`'s hardcoded `/dashboard`
 * fallback did until a professional landed there instead of `/clinico/...`.
 */
export function defaultHomePath(user: UsuarioAutenticado | null): string {
  if (panelAreaOf(user) === "clinico" && user?.especialidade) {
    return `/clinico/${user.especialidade}`;
  }

  return "/dashboard";
}
