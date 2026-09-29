import { useEffect } from "react";
import { Navigate, Outlet, useLocation, useParams } from "react-router-dom";

import { Loading } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ESPECIALIDADE, ESPECIALIDADE_LABEL, PAPEL, type Especialidade } from "@/lib/enums";
import { MobileMenu } from "./MobileMenu";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { clinicoNavItems } from "./clinico-navigation";

/**
 * Clinical panel frame: sidebar + topbar + content area.
 *
 * Sibling of `AdminLayout`, not a variant of it — different audience (the
 * professional's own workspace, not the clinic's administration), different
 * navigation, and a route segment (`:especialidade`) the admin panel does not
 * have. Reuses `Sidebar`/`Topbar`/`MobileMenu` because those three are already
 * generic; only the navigation source and the two or three strings around the
 * brand differ. See PA-07 for why this exists as its own frame.
 */

const ESPECIALIDADES_VALIDAS = new Set<string>(Object.values(ESPECIALIDADE));

export function ClinicoLayout() {
  const { especialidade } = useParams<{ especialidade: string }>();
  const location = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const especialidadeDoUsuario = user?.especialidade ?? null;
  const valida = Boolean(especialidade && ESPECIALIDADES_VALIDAS.has(especialidade));

  /*
   * A professional's own specialty is their only home here — a farmacêutico
   * opening `/clinico/psicologo/` by hand does not become a psicólogo.
   * Administrators are the exception: the same broad read they already have
   * on the administrative side extends to reviewing any area from here, which
   * is what lets them tell whether a screen is honestly showing "nothing yet"
   * or hiding a real defect.
   */
  const restritoAPropria =
    valida &&
    user?.papel === PAPEL.PROFISSIONAL &&
    especialidadeDoUsuario &&
    especialidade !== especialidadeDoUsuario;

  // Every hook below runs on every render, whatever branch we take further
  // down — conditional returns come after, never between them.
  const area = valida && !restritoAPropria ? (especialidade as Especialidade) : null;
  const items = area ? clinicoNavItems(area) : [];
  const homePath = area ? `/clinico/${area}` : "";

  const itemAtual = area
    ? items.find(
        (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
      )
    : undefined;
  const nomeDaTela = itemAtual?.title ?? itemAtual?.label;

  useDocumentTitle(
    area
      ? nomeDaTela
        ? `${nomeDaTela} · ${ESPECIALIDADE_LABEL[area]} · Jornada Supera`
        : `${ESPECIALIDADE_LABEL[area]} · Jornada Supera`
      : "Jornada Supera",
  );

  if (isLoading) return <Loading message="Verificando acesso…" />;

  if (!valida) {
    return (
      <Navigate
        to={especialidadeDoUsuario ? `/clinico/${especialidadeDoUsuario}` : "/dashboard"}
        replace
      />
    );
  }

  if (restritoAPropria) {
    return <Navigate to={`/clinico/${especialidadeDoUsuario}`} replace />;
  }

  // `area` is guaranteed set from here on — both branches that leave it `null`
  // returned above.
  const areaAtual = area as Especialidade;

  return (
    <div className="bg-background flex min-h-dvh">
      <a href="#conteudo-principal" className="skip-link">
        Pular para o conteúdo
      </a>

      <Sidebar items={items} homePath={homePath} subtitle={ESPECIALIDADE_LABEL[areaAtual]} />
      <MobileMenu items={items} homePath={homePath} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main
          id="conteudo-principal"
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus:outline-none"
        >
          <div className="mx-auto w-full max-w-(--breakpoint-2xl) space-y-6 px-4 py-6 sm:px-6 xl:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default ClinicoLayout;
