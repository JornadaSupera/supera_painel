import { PAPEL } from "@/lib/enums";
import type { UsuarioAutenticado } from "@/types/auth";

/**
 * Where an authenticated person belongs by default.
 *
 * A professional's home is their own clinical area, not the administrative
 * dashboard — see PA-07. Shared by every place that decides a post-auth
 * destination (`LoginPage`, `MfaPage`, `HomeRedirect`) so the three never
 * drift into disagreeing about it, the way `/login`'s hardcoded `/dashboard`
 * fallback did until a professional landed there instead of `/clinico/...`.
 */
export function defaultHomePath(user: UsuarioAutenticado | null): string {
  if (user?.papel === PAPEL.PROFISSIONAL && user.especialidade) {
    return `/clinico/${user.especialidade}`;
  }

  return "/dashboard";
}
