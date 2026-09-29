import { Navigate } from "react-router-dom";

import { Loading } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { defaultHomePath } from "./home-path";

/**
 * Where "/" and an unknown address send someone.
 *
 * Signed in, the destination is `defaultHomePath(user)` — see `home-path.ts`.
 *
 * Signed OUT, it goes straight to `/login`, never through `/dashboard`. It
 * used to fall back to `/dashboard` unconditionally, on the reasoning that
 * `ProtectedRoute` would catch an anonymous visitor there and bounce them to
 * `/login` anyway. It does — but on the way it also records `/dashboard` as
 * `location.state.from`, the address `LoginPage`/`MfaPage` return to after a
 * successful sign-in. That address wins over `defaultHomePath(user)` there,
 * on purpose — a real deep link has to survive login — which is exactly what
 * let a generic guess a professional never asked for outlive the sign-in and
 * land them back on the admin dashboard.
 */
export function HomeRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Loading />;

  return <Navigate to={isAuthenticated ? defaultHomePath(user) : "/login"} replace />;
}

export default HomeRedirect;
