import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Breadcrumb } from "@/components/shared";
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
 */
export function AdminLayout() {
  const location = useLocation();
  const trail = navTrailByPath(location.pathname);

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
            {/* Only appears from the second level down. A one-item crumb is
                noise: it repeats what the title and the sidebar already say. */}
            {trail.length > 1 && (
              <Breadcrumb
                items={trail.map((item) => ({ label: item.label, to: item.to }))}
                className="mb-4"
              />
            )}

            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
