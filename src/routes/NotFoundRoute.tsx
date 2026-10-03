import { Link, Navigate } from "react-router-dom";

import { ErrorState, Loading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { ERROR_CODE } from "@/services/contracts";
import { defaultHomePath } from "./home-path";

/**
 * An address the panel does not have.
 *
 * It used to share the redirect of `/`: a mistyped or stale link dropped the
 * person on the home screen with no word about it, which reads as if the link
 * had worked. Signed in, they are told the address does not exist and offered
 * the way home. Signed out there is nothing to explain, and the sign-in screen
 * is where every address of the panel starts.
 */
export function NotFoundRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <main className="relative isolate flex min-h-svh flex-col items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden="true"
        className="supera-pattern-ink [--pattern-opacity:0.06] [--pattern-w:18rem]"
      />
      <p
        aria-hidden="true"
        className="text-primary/25 font-mono text-8xl font-semibold tracking-tighter select-none"
      >
        404
      </p>
      <ErrorState
        error={{ code: ERROR_CODE.NOT_FOUND }}
        title="Página não encontrada"
        description="Este endereço não existe no painel. Confira o link ou volte ao início."
        actions={
          <Button asChild>
            <Link to={defaultHomePath(user)}>Voltar ao início</Link>
          </Button>
        }
      />
    </main>
  );
}

export default NotFoundRoute;
