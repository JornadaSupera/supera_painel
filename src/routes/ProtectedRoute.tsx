import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Loading } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";

/**
 * Exige sessão válida.
 *
 * Guarda o destino em `state.from` para devolver a pessoa exatamente onde ela
 * estava depois do login — perder o contexto é um atrito pequeno que se repete
 * o dia inteiro num painel.
 */
export function ProtectedRoute() {
  const { autenticado, carregando } = useAuth();
  const location = useLocation();

  // Sem isto, a restauração da sessão empurraria todo mundo para /login no
  // primeiro frame.
  if (carregando) return <Loading mensagem="Verificando acesso…" />;

  if (!autenticado) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
