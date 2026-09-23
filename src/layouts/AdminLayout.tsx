import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Breadcrumb, Loading } from "@/components/shared";
import { SessaoSemSegundoFator } from "@/features/auth/components/SessaoSemSegundoFator";
import { useGarantiaDaSessao } from "@/hooks/useGarantiaDaSessao";
import { MobileMenu } from "./MobileMenu";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { navItemByPath, navTrailByPath } from "./navigation";

/**
 * Panel frame: sidebar + topbar + content area.
 *
 * It sits between `ProtectedRoute` and the pages, so only someone with a
 * session sees the navigation — and so the sidebar does not remount on every
 * route change.
 *
 * It is also where the panel checks that what the pages are about to show is
 * real. When the backend requires a second factor and the session only carries
 * a password, nothing errors: every screen answers with an empty list. The
 * check lives here, once, instead of in each of the nine screens.
 */
export function AdminLayout() {
  const location = useLocation();
  const trail = navTrailByPath(location.pathname);
  const garantia = useGarantiaDaSessao();

  /*
   * The frame renders either way. Only the content area waits, and only while
   * the answer is unknown — the sidebar and the sign-out menu stay reachable,
   * which matters most in exactly the case this check exists for.
   *
   * A failed check does NOT block: a diagnostic that takes the panel down when
   * it cannot run turns a dropped request into an inaccessible panel.
   */
  const bloqueado = garantia.data ? !garantia.data.suficiente : false;

  /* The tab title follows the screen: with several tabs open, "Jornada
     Supera" repeated helps nobody find their way. */
  useEffect(() => {
    const item = navItemByPath(location.pathname);
    const name = item?.title ?? item?.label;
    document.title = name ? `${name} · Jornada Supera` : "Jornada Supera · Administração";
  }, [location.pathname]);

  /* Changing pages puts the scroll back at the top. Without it, landing in the
     middle of a new screen is disorienting. */
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="bg-background flex min-h-dvh">
      {/* First focusable element on the page: skips the whole navigation. */}
      <a href="#conteudo-principal" className="skip-link">
        Pular para o conteúdo
      </a>

      <Sidebar />
      <MobileMenu />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <main
          id="conteudo-principal"
          // `tabIndex={-1}` lets "skip to content" actually move the focus
          // here, instead of only scrolling the page.
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus:outline-none"
        >
          {/* Full width, no `max-w`.
              The reference locks the content at 1280px, but that is a
              limitation of the mockup: in a data panel, every extra horizontal
              pixel fits another table column and gives the charts room. A
              white band down the sides of a work monitor is waste, not
              breathing room. */}
          <div className="w-full space-y-6 px-4 py-6 sm:px-6 xl:px-8">
            {garantia.isLoading ? (
              <Loading message="Verificando o nível de acesso…" />
            ) : bloqueado && garantia.data ? (
              <SessaoSemSegundoFator garantia={garantia.data} />
            ) : (
              <>
                {/* Only appears from the second level down. A one-item crumb is
                    noise: it repeats what the title and the sidebar already say. */}
                {trail.length > 1 && (
                  <Breadcrumb
                    items={trail.map((item) => ({ label: item.label, to: item.to }))}
                    className="mb-4"
                  />
                )}

                <Outlet />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
