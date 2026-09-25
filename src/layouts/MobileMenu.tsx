import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { Can, Logo } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout";
import { visibleNavItems, type NavItem } from "./navigation";

/**
 * Navigation menu on narrow screens.
 *
 * The panel is desktop-first — 1280px minimum — but it has to degrade usably on
 * a tablet. Here the sidebar becomes a drawer.
 *
 * It reuses the shadcn `Dialog` to inherit focus trapping, Esc and `inert` on
 * the rest of the page, instead of reimplementing all that in a `<div>`.
 */

function Link({ item, nested = false }: { item: NavItem; nested?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === "/dashboard"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
          nested && "ml-4 text-[13px]",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-foreground/75 hover:bg-muted hover:text-foreground",
        )
      }
    >
      <item.icon size={17} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

export function MobileMenu() {
  const open = useLayoutStore((s) => s.mobileMenuOpen);
  const setOpen = useLayoutStore((s) => s.setMobileMenuOpen);
  const location = useLocation();

  // Navigating closes the drawer: leaving it open over the new screen forces a
  // second gesture just to see what was opened.
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, setOpen]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* `flex flex-col` over the dialog's grid: a grid at full height split
          the spare room between header and nav, and the first item started
          at ~40% of the screen, below an empty band under the logo. */}
      <DialogContent className="top-0 left-0 flex h-dvh max-w-72 translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0 sm:max-w-72">
        <DialogHeader className="border-border border-b p-4 text-left">
          <DialogTitle className="flex items-center gap-3 text-base">
            <Logo height={24} />
            <span className="border-border border-l pl-3">Jornada Supera</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Navegação principal do painel</DialogDescription>
        </DialogHeader>

        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-0.5">
            {visibleNavItems().map((item) => (
              <Can key={item.to} permission={item.permission} anyOf={item.anyOf}>
                <li className="flex flex-col gap-0.5">
                  {item.children ? (
                    <>
                      <span className="text-muted-foreground px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                        {item.label}
                      </span>
                      {item.children.map((child) => (
                        <Can key={child.to} permission={child.permission} anyOf={child.anyOf}>
                          <Link item={child} nested />
                        </Can>
                      ))}
                    </>
                  ) : (
                    <Link item={item} />
                  )}
                </li>
              </Can>
            ))}
          </ul>
        </nav>
      </DialogContent>
    </Dialog>
  );
}

export default MobileMenu;
