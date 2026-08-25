import { Outlet } from "react-router-dom";

import { ErrorState } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import type { Permissao } from "@/lib/rbac";

/**
 * Exige permissão, além de sessão.
 *
 * Renderiza "sem permissão" em vez de redirecionar: mandar a pessoa para outra
 * tela sem explicação faz parecer bug. Dizer que o acesso existe mas não é dela
 * é informação acionável — ela sabe a quem pedir.
 *
 * @param permissao  uma ou várias — todas exigidas (E lógico)
 * @param alguma     lista alternativa — basta uma (OU lógico)
 */
export interface PermissionRouteProps {
  permissao?: Permissao | readonly Permissao[];
  alguma?: readonly Permissao[];
}

export function PermissionRoute({ permissao, alguma }: PermissionRouteProps) {
  const { pode, podeAlguma } = useAuth();

  const autorizado = alguma ? podeAlguma(alguma) : permissao ? pode(permissao) : true;

  if (!autorizado) return <ErrorState variant="forbidden" />;

  return <Outlet />;
}

export default PermissionRoute;
