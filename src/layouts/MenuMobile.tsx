import { Activity } from "lucide-react";
import { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { Can } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout";
import { NAVEGACAO, type ItemNavegacao } from "./navegacao";

/**
 * Menu de navegação em telas estreitas.
 *
 * O painel é desktop-first — mínimo de 1280 px, mas
 * precisa degradar de forma usável em tablet. Aqui a sidebar vira gaveta.
 *
 * Reaproveita o `Dialog` do shadcn para herdar foco preso, Esc e `inert` no
 * restante da página, em vez de reimplementar isso num `<div>`.
 */

function Link({ item, nested = false }: { item: ItemNavegacao; nested?: boolean }) {
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

export function MenuMobile() {
  const aberto = useLayoutStore((s) => s.menuMobileAberto);
  const setAberto = useLayoutStore((s) => s.setMenuMobileAberto);
  const location = useLocation();

  // Navegar fecha a gaveta: deixá-la aberta sobre a tela nova obriga a um
  // segundo gesto para ver o que acabou de ser aberto.
  useEffect(() => {
    setAberto(false);
  }, [location.pathname, setAberto]);

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogContent className="top-0 left-0 h-dvh max-w-72 translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:max-w-72">
        <DialogHeader className="border-border border-b p-4 text-left">
          <DialogTitle className="flex items-center gap-3 text-base">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <Activity size={18} aria-hidden="true" />
            </span>
            Jornada Supera
          </DialogTitle>
          <DialogDescription className="sr-only">Navegação principal do painel</DialogDescription>
        </DialogHeader>

        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-0.5">
            {NAVEGACAO.map((item) => (
              <Can key={item.to} permissao={item.permissao} alguma={item.alguma}>
                <li className="flex flex-col gap-0.5">
                  {item.filhos ? (
                    <>
                      <span className="text-muted-foreground px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase">
                        {item.label}
                      </span>
                      {item.filhos.map((filho) => (
                        <Can key={filho.to} permissao={filho.permissao} alguma={filho.alguma}>
                          <Link item={filho} nested />
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

export default MenuMobile;
