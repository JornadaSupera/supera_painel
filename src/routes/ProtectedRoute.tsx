import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Loading } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";

/**
 * Requires a valid session.
 *
 * It stores the destination in `state.from` to bring the person back exactly
 * where they were after signing in — losing that context is a small friction
 * that repeats all day long in a panel.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Without this, restoring the session would push everyone to /login on the
  // first frame.
  if (isLoading) return <Loading message="Verificando acesso…" />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
