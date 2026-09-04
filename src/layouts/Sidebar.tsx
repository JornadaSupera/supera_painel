import { Activity, ChevronDown, ChevronsLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { Can } from "@/components/shared";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout";
import { visibleNavItems, type NavItem } from "./navigation";

/**
 * Side navigation.
 *
 * ## How the collapse was made smooth
 *
 * The naive path — dropping the label from the DOM on collapse — produces a
 * jump: the text disappears in one frame and the width animates in the next.
 * Nothing is unmounted here. The label stays in the DOM and animates
 * `grid-template-columns` from `1fr` to `0fr`, which gives the browser a
 * continuous width transition, together with a fade. The icon never moves,
 * because the item padding does not change: only the space to its right
 * shrinks.
 *
 * The three animations — bar width, label width and opacity — share the same
 * duration and the same curve, so it reads as a single movement.
 */

/* Reference measurements: gap-2.5, px-2.5, py-1.5, size-4 icon. */
const ITEM_BASE =
  "group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors";

const ITEM_ACTIVE = "bg-primary/10 text-primary font-medium";
const ITEM_INACTIVE = "text-muted-foreground hover:bg-muted hover:text-foreground";

/** Curve and duration shared by everything that moves during the collapse. */
const MOTION = "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]";

/**
 * A label that shrinks away without leaving the DOM.
 *
 * The single-column grid is the trick: `1fr → 0fr` is animatable, whereas
 * `width: auto → 0` is not.
 */
function Label({
  collapsed,
  children,
  className,
}: {
  collapsed: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      aria-hidden={collapsed}
      className={cn(
        "grid transition-[grid-template-columns,opacity] motion-reduce:transition-none",
        MOTION,
        collapsed ? "grid-cols-[0fr] opacity-0" : "grid-cols-[1fr] opacity-100",
        className,
      )}
    >
      <span className="overflow-hidden whitespace-nowrap">{children}</span>
    </span>
  );
}

function LevelMarker({ collapsed }: { collapsed: boolean }) {
  return (
    <Label collapsed={collapsed}>
      <span className="bg-supera-uniao/15 text-supera-uniao ml-1 rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wide">
        Médio
      </span>
    </Label>
  );
}

function ItemLink({
  item,
  collapsed,
  nested = false,
}: {
  item: NavItem;
  collapsed: boolean;
  nested?: boolean;
}) {
  const content = (
    <NavLink
      to={item.to}
      // `end` only on the dashboard: the others need to stay active on their
      // subroutes (`/pacientes/:id` keeps "Pacientes" highlighted).
      end={item.to === "/dashboard"}
      className={({ isActive }) =>
        cn(ITEM_BASE, isActive ? ITEM_ACTIVE : ITEM_INACTIVE, nested && "text-[13px]")
      }
    >
      <item.icon size={16} className="shrink-0" aria-hidden="true" />
      <Label collapsed={collapsed} className="flex-1 text-left">
        {item.label}
      </Label>
      {item.mediumLevel && !nested && <LevelMarker collapsed={collapsed} />}
    </NavLink>
  );

  // Collapsed, the visible label is gone — the tooltip becomes the item name.
  if (!collapsed) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

function Group({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const location = useLocation();
  const containsActive = location.pathname.startsWith(item.to);
  const [open, setOpen] = useState(containsActive);

  // Collapsing closes the submenu; expanding back reopens it when the current
  // route lives inside. Without this, the bar reopens with a submenu hanging
  // over nothing.
  useEffect(() => {
    if (collapsed) setOpen(false);
    else if (containsActive) setOpen(true);
  }, [collapsed, containsActive]);

  const firstChild = item.children?.[0];

  // Collapsed, the group becomes a shortcut to its first child: there is no
  // room for a submenu, and a button that opens nothing is confusing. The icon
  // stays in the same place, so the swap goes unnoticed.
  if (collapsed && firstChild) {
    return (
      <li>
        <ItemLink item={{ ...firstChild, icon: item.icon, label: item.label }} collapsed />
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(ITEM_BASE, containsActive ? "text-foreground font-medium" : ITEM_INACTIVE)}
      >
        <item.icon size={16} className="shrink-0" aria-hidden="true" />
        <Label collapsed={collapsed} className="flex-1 text-left">
          {item.label}
        </Label>
        {item.mediumLevel && <LevelMarker collapsed={collapsed} />}
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={cn("shrink-0 transition-transform", MOTION, open && "rotate-180")}
        />
      </button>

      {/* The submenu opens through the grid too, so it does not jump. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] motion-reduce:transition-none",
          MOTION,
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <ul className="border-sidebar-border mt-1 ml-[1.0625rem] flex flex-col gap-0.5 border-l pl-3">
            {item.children?.map((child) => (
              <Can key={child.to} permission={child.permission} anyOf={child.anyOf}>
                <li>
                  <ItemLink item={child} collapsed={false} nested />
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
  const collapsed = useLayoutStore((state) => state.sidebarCollapsed);
  const toggle = useLayoutStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh shrink-0 flex-col border-r lg:flex",
        "transition-[width] motion-reduce:transition-none",
        MOTION,
        // 60px when collapsed: nav padding (24) + item padding (20) + icon
        // (16). The icon lands exactly centred without `justify-center`, which
        // would cause a jump mid-animation.
        collapsed ? "w-15" : "w-64",
      )}
    >
      {/* ------------------------------------------------------------- brand */}
      <div className="border-sidebar-border flex h-15 shrink-0 items-center gap-2.5 border-b px-[0.875rem]">
        <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
          <Activity size={18} aria-hidden="true" />
        </span>
        <Label collapsed={collapsed}>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Jornada Supera</span>
            <span className="text-muted-foreground text-[11px]">Administração</span>
          </span>
        </Label>
      </div>

      {/* -------------------------------------------------------- navigation */}
      <nav aria-label="Navegação principal" className="flex-1 overflow-x-hidden overflow-y-auto px-3 py-4">
        <ul className="flex flex-col gap-0.5">
          {visibleNavItems().map((item) => (
            <Can key={item.to} permission={item.permission} anyOf={item.anyOf}>
              {item.children ? (
                <Group item={item} collapsed={collapsed} />
              ) : (
                <li>
                  <ItemLink item={item} collapsed={collapsed} />
                </li>
              )}
            </Can>
          ))}
        </ul>
      </nav>

      {/* ---------------------------------------------------------- collapse */}
      <div className="border-sidebar-border shrink-0 border-t p-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!collapsed}
          className={cn(ITEM_BASE, ITEM_INACTIVE)}
        >
          {/* The arrow rotates instead of swapping icons: swapping the glyph
              flickers. */}
          <ChevronsLeft
            size={16}
            aria-hidden="true"
            className={cn("shrink-0 transition-transform", MOTION, collapsed && "rotate-180")}
          />
          <Label collapsed={collapsed} className="flex-1 text-left">
            Recolher menu
          </Label>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
