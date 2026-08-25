import type { ReactNode } from "react";

import { useAuth } from "@/contexts/auth-context";
import type { Permissao } from "@/lib/rbac";

/**
 * Interface guard.
 *
 *   <Can permission={PERMISSAO.PACIENTES_WRITE}>
 *     <Button>Novo paciente</Button>
 *   </Can>
 *
 * > [!] Hiding is not protecting.
 * This component keeps someone from seeing an action they cannot perform,
 * which cuts honest mistakes and screen noise. It does **not** stop anyone who
 * opens the DevTools. Every action wrapped in `<Can>` also needs a guarded
 * route (`PermissionRoute`) and, once the backend exists, a row level security
 * policy in Postgres.
 *
 * @param permission  one or many — all of them required (logical AND)
 * @param anyOf       alternative list — one is enough (logical OR)
 * @param fallback    what to render when the permission is missing
 */
export interface CanProps {
  permission?: Permissao | readonly Permissao[];
  anyOf?: readonly Permissao[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permission, anyOf, fallback = null, children }: CanProps) {
  const { can, canAny } = useAuth();

  const allowed = anyOf ? canAny(anyOf) : permission ? can(permission) : true;

  return <>{allowed ? children : fallback}</>;
}

export default Can;
