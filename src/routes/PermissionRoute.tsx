import { Outlet } from "react-router-dom";

import { ErrorState } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import type { Permissao } from "@/lib/rbac";

/**
 * Requires a permission, on top of a session.
 *
 * It renders "forbidden" instead of redirecting: sending someone to another
 * screen with no explanation reads as a bug. Telling them the access exists
 * but is not theirs is actionable — they know who to ask.
 *
 * @param permission  one or many — all of them required (logical AND)
 * @param anyOf       alternative list — one is enough (logical OR)
 */
export interface PermissionRouteProps {
  permission?: Permissao | readonly Permissao[];
  anyOf?: readonly Permissao[];
}

export function PermissionRoute({ permission, anyOf }: PermissionRouteProps) {
  const { can, canAny } = useAuth();

  const allowed = anyOf ? canAny(anyOf) : permission ? can(permission) : true;

  if (!allowed) return <ErrorState variant="forbidden" />;

  return <Outlet />;
}

export default PermissionRoute;
