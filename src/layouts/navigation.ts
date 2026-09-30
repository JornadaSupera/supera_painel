import {
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquareHeart,
  ScrollText,
  Settings,
  TrendingUp,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { PERMISSAO, type Permissao } from "@/lib/rbac";

/**
 * PANEL NAVIGATION
 * =============================================================================
 * Single source for the sidebar, the breadcrumb and the page title. A new item
 * is added here and shows up in all three — no keeping three lists in sync by
 * hand.
 *
 * The nine screens match the reference prototype exactly.
 */

export interface NavItem {
  /** Label in the sidebar. */
  label: string;
  to: string;
  icon: LucideIcon;
  /** Without the permission the item is not rendered — and the route is guarded too. */
  permission?: Permissao;
  /** One of the permissions is enough (logical OR). Use instead of `permission`. */
  anyOf?: readonly Permissao[];
  /** Contract level Médio — flagged in the interface. */
  mediumLevel?: boolean;
  /**
   * The screen exists as a route but has not been built yet.
   *
   * Kept in this list rather than deleted: `navItemByPath` and
   * `navTrailByPath` still resolve the title and the breadcrumb, so a
   * bookmarked URL renders with a proper header instead of a bare placeholder.
   * What `visibleNavItems` drops is the sidebar entry — a menu that leads to
   * six empty rooms teaches people to distrust the menu.
   */
  pending?: boolean;
  children?: NavItem[];
  /** Page title; falls back to `label` when absent. */
  title?: string;
  /** Header subtitle, when it is fixed. */
  subtitle?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    permission: PERMISSAO.DASHBOARD_READ,
    title: "Dashboard executivo",
  },
  {
    label: "Pacientes",
    to: "/pacientes",
    icon: Users,
    permission: PERMISSAO.PACIENTES_READ,
  },
  {
    label: "Usuários",
    to: "/usuarios",
    icon: UsersRound,
    permission: PERMISSAO.USUARIOS_READ,
  },
  {
    label: "Conteúdo",
    to: "/conteudo",
    icon: FileText,
    permission: PERMISSAO.CONTEUDO_READ,
    title: "Aprovação de conteúdo",
    subtitle: "Workflow editorial",
  },
  {
    label: "Relatórios",
    to: "/relatorios",
    icon: ClipboardList,
    permission: PERMISSAO.RELATORIOS_READ,
    subtitle: "12 relatórios pré-definidos",
  },
  {
    label: "Satisfação",
    to: "/satisfacao",
    icon: MessageSquareHeart,
    permission: PERMISSAO.SATISFACAO_READ,
    title: "Satisfação dos pacientes",
    subtitle: "Pesquisa NPS · notas e comentários",
  },
  {
    label: "Estatísticas",
    to: "/estatisticas",
    icon: TrendingUp,
    mediumLevel: true,
    anyOf: [
      PERMISSAO.ESTATISTICAS_CLINICAS_READ,
      PERMISSAO.ESTATISTICAS_READ_ALL,
      PERMISSAO.ESTATISTICAS_READ_SELF,
    ],
    children: [
      {
        label: "Clínicas",
        to: "/estatisticas/clinicas",
        icon: TrendingUp,
        permission: PERMISSAO.ESTATISTICAS_CLINICAS_READ,
        mediumLevel: true,
        title: "Estatísticas clínicas",
        subtitle: "Cruzamento Protocolo × Efeito × Grau",
      },
      {
        label: "Operacionais",
        to: "/estatisticas/operacionais",
        icon: TrendingUp,
        anyOf: [PERMISSAO.ESTATISTICAS_READ_ALL, PERMISSAO.ESTATISTICAS_READ_SELF],
        mediumLevel: true,
        title: "Estatísticas operacionais",
        subtitle: "Operação da clínica",
      },
    ],
  },
  {
    label: "Auditoria & logs",
    to: "/auditoria",
    icon: ScrollText,
    permission: PERMISSAO.AUDITORIA_READ,
    mediumLevel: true,
    title: "Auditoria & logs",
    subtitle: "Rastro de acesso a dados sensíveis · retenção de 5 anos",
  },
  {
    label: "Configurações",
    to: "/configuracoes",
    icon: Settings,
    permission: PERMISSAO.CONFIGURACOES_READ,
  },
];

/**
 * What the sidebar shows: everything except the screens still to be built.
 *
 * Only the menu is filtered. The routes stay reachable, so a link already
 * shared keeps working and lands on the placeholder — hiding the entry is
 * about not promising what is not there, not about breaking addresses.
 */
export function visibleNavItems(items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items
    .filter((item) => !item.pending)
    .map((item) =>
      item.children ? { ...item, children: visibleNavItems(item.children) } : item,
    );
}

/** Every item as a flat list, parents and children alike. */
export function flatNavItems(items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.flatMap((item) => [item, ...flatNavItems(item.children ?? [])]);
}

/**
 * The item matching a path.
 * Prefers the longest match, so `/estatisticas/clinicas` beats
 * `/estatisticas` — and `/clinico/x/pacientes` beats the area's home,
 * `/clinico/x`, which is a prefix of every clinical route.
 */
export function navItemByPath(
  pathname: string,
  items: NavItem[] = NAV_ITEMS,
): NavItem | undefined {
  return flatNavItems(items)
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

/**
 * Title of a screen that is a route but not a menu item: the account security
 * page, and a patient record inside the clinical panel. Without it the tab
 * borrowed the nearest menu item's name ("Painel do dia" on the security page,
 * "Carteira de pacientes" on a record).
 *
 * `prefix` is the panel's base path: empty for the administrative panel,
 * `/clinico/<specialty>` for the clinical one. A patient record has its own
 * title only in the clinical panel; in the administrative one the list's name
 * is already the right one.
 */
export function extraRouteTitle(pathname: string, prefix = ""): string | undefined {
  if (pathname === `${prefix}/seguranca`) return "Segurança da conta";
  if (prefix && pathname.startsWith(`${prefix}/pacientes/`)) return "Ficha do paciente";
  return undefined;
}

/** Navigation trail for the current path. */
export function navTrailByPath(pathname: string): NavItem[] {
  const trail: NavItem[] = [];

  for (const parent of NAV_ITEMS) {
    if (pathname === parent.to || pathname.startsWith(`${parent.to}/`)) {
      trail.push(parent);

      const child = parent.children?.find(
        (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
      );
      if (child) trail.push(child);

      break;
    }
  }

  return trail;
}
