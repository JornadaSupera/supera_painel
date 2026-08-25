import { Activity, ChevronDown, ChevronsLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { Can } from "@/components/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout";
import { NAVEGACAO, type ItemNavegacao } from "./navegacao";

/**
 * Navegação lateral.
 *
 * ## Como o recolhimento foi feito liso
 *
 * O caminho ingênuo — remover o rótulo do DOM quando recolhe — produz um
 * salto: o texto some num quadro e a largura anima no seguinte. Aqui nada é
 * desmontado. O rótulo continua no DOM e anima `grid-template-columns` de
 * `1fr` para `0fr`, o que dá ao navegador uma transição contínua de largura,
 * junto com um fade. O ícone nunca muda de posição, porque o padding do item
 * não muda: só o espaço à direita dele encolhe.
 *
 * As três animações — largura da barra, largura do rótulo e opacidade — usam a
 * mesma duração e a mesma curva, então a leitura é de um movimento só.
 */

/* Medidas do protótipo: gap-2.5, px-2.5, py-1.5, ícone size-4. */
const ITEM_BASE =
  "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors";

const ITEM_ATIVO = "bg-primary/10 text-primary font-medium";
const ITEM_INATIVO = "text-muted-foreground hover:bg-muted hover:text-foreground";

/** Curva e duração compartilhadas por tudo que se move no recolhimento. */
const MOVIMENTO = "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

/**
 * Rótulo que encolhe até sumir, sem sair do DOM.
 *
 * A grade de uma coluna é o truque: `1fr → 0fr` é animável, enquanto
 * `width: auto → 0` não é.
 */
function Rotulo({
  colapsada,
  children,
  className,
}: {
  colapsada: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden={colapsada}
      className={cn(
        "grid transition-[grid-template-columns,opacity] motion-reduce:transition-none",
        MOVIMENTO,
        colapsada ? "grid-cols-[0fr] opacity-0" : "grid-cols-[1fr] opacity-100",
        className,
      )}
    >
      <span className="overflow-hidden whitespace-nowrap">{children}</span>
    </span>
  );
}

function Marcador({ colapsada }: { colapsada: boolean }) {
  return (
    <Rotulo colapsada={colapsada}>
      <span className="bg-supera-uniao/15 text-supera-uniao ml-1 rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wide">
        Médio
      </span>
    </Rotulo>
  );
}

function ItemLink({
  item,
  colapsada,
  aninhado = false,
}: {
  item: ItemNavegacao;
  colapsada: boolean;
  aninhado?: boolean;
}) {
  const conteudo = (
    <NavLink
      to={item.to}
      // `end` só no dashboard: os demais precisam marcar-se ativos nas subrotas
      // (`/pacientes/:id` mantém "Pacientes" destacado).
      end={item.to === "/dashboard"}
      className={({ isActive }) =>
        cn(ITEM_BASE, isActive ? ITEM_ATIVO : ITEM_INATIVO, aninhado && "text-[13px]")
      }
    >
      <item.icon size={16} className="shrink-0" aria-hidden="true" />
      <Rotulo colapsada={colapsada} className="flex-1 text-left">
        {item.label}
      </Rotulo>
      {item.nivelMedio && !aninhado && <Marcador colapsada={colapsada} />}
    </NavLink>
  );

  // Recolhida, o rótulo visível some — o tooltip passa a ser o nome do item.
  if (!colapsada) return conteudo;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{conteudo}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function Grupo({ item, colapsada }: { item: ItemNavegacao; colapsada: boolean }) {
  const location = useLocation();
  const contemAtiva = location.pathname.startsWith(item.to);
  const [aberto, setAberto] = useState(contemAtiva);

  // Recolher fecha o submenu; expandir de volta reabre se a rota atual está
  // dentro dele. Sem isso, a barra reabre com um submenu aberto sobre nada.
  useEffect(() => {
    if (colapsada) setAberto(false);
    else if (contemAtiva) setAberto(true);
  }, [colapsada, contemAtiva]);

  const primeiro = item.filhos?.[0];

  // Recolhida, o grupo vira atalho para o primeiro filho: não há espaço para
  // submenu, e um botão que não abre nada confunde. O ícone fica no mesmo
  // lugar, então a troca não é percebida.
  if (colapsada && primeiro) {
    return (
      <li>
        <ItemLink item={{ ...primeiro, icon: item.icon, label: item.label }} colapsada />
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className={cn(ITEM_BASE, contemAtiva ? "text-foreground font-medium" : ITEM_INATIVO)}
      >
        <item.icon size={16} className="shrink-0" aria-hidden="true" />
        <Rotulo colapsada={colapsada} className="flex-1 text-left">
          {item.label}
        </Rotulo>
        {item.nivelMedio && <Marcador colapsada={colapsada} />}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform", MOVIMENTO, aberto && "rotate-180")}
        />
      </button>

      {/* O submenu também abre por grade, para não saltar. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] motion-reduce:transition-none",
          MOVIMENTO,
          aberto ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <ul className="border-sidebar-border mt-1 ml-[1.0625rem] flex flex-col gap-0.5 border-l pl-3">
            {item.filhos?.map((filho) => (
              <Can key={filho.to} permissao={filho.permissao} alguma={filho.alguma}>
                <li>
                  <ItemLink item={filho} colapsada={false} aninhado />
                </li>
              </Can>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

export function Sidebar() {
  const colapsada = useLayoutStore((state) => state.sidebarColapsada);
  const alternar = useLayoutStore((state) => state.alternarSidebar);

  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh shrink-0 flex-col border-r lg:flex",
        "transition-[width] motion-reduce:transition-none",
        MOVIMENTO,
        // 60px recolhida: padding do nav (24) + padding do item (20) + ícone
        // (16). O ícone fica exatamente centrado, sem precisar de `justify-center`
        // — que causaria salto no meio da animação.
        colapsada ? "w-15" : "w-64",
      )}
    >
      {/* ------------------------------------------------------------- marca */}
      <div className="border-sidebar-border flex h-15 shrink-0 items-center gap-2.5 border-b px-[0.875rem]">
        <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Activity size={18} aria-hidden="true" />
        </span>
        <Rotulo colapsada={colapsada}>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Jornada Supera</span>
            <span className="text-muted-foreground text-[11px]">Administração</span>
          </span>
        </Rotulo>
      </div>

      {/* --------------------------------------------------------- navegação */}
      <nav aria-label="Navegação principal" className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {NAVEGACAO.map((item) => (
            <Can key={item.to} permissao={item.permissao} alguma={item.alguma}>
              {item.filhos ? (
                <Grupo item={item} colapsada={colapsada} />
              ) : (
                <li>
                  <ItemLink item={item} colapsada={colapsada} />
                </li>
              )}
            </Can>
          ))}
        </ul>
      </nav>

      {/* ---------------------------------------------------------- colapsar */}
      <div className="border-sidebar-border shrink-0 border-t p-3">
        <button
          type="button"
          onClick={alternar}
          aria-label={colapsada ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!colapsada}
          className={cn(ITEM_BASE, ITEM_INATIVO)}
        >
          {/* A seta gira em vez de trocar de ícone: trocar o glifo pisca. */}
          <ChevronsLeft
            size={16}
            aria-hidden="true"
            className={cn("shrink-0 transition-transform", MOVIMENTO, colapsada && "rotate-180")}
          />
          <Rotulo colapsada={colapsada} className="flex-1 text-left">
            Recolher menu
          </Rotulo>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
