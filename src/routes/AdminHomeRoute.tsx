import { Navigate, Outlet } from "react-router-dom";

import { Loading } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { defaultHomePath } from "./home-path";

/**
 * Keeps the executive dashboard for the people it was made for.
 *
 * A professional holds `dashboard:read`, so the permission guard alone lets them
 * open `/dashboard` by typing it. The clinic-wide numbers are not their home —
 * their own clinical area is — so anyone whose default home is elsewhere is
 * sent there, the same destination sign-in already picks for them.
 */
export function AdminHomeRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <Loading />;

  const home = defaultHomePath(user);
  if (home !== "/dashboard") return <Navigate to={home} replace />;

  return <Outlet />;
}

export default AdminHomeRoute;
