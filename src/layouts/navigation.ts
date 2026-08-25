import {
  ClipboardList,
  FileText,
  LayoutDashboard,
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

/** Every item as a flat list, parents and children alike. */
export function flatNavItems(items: NavItem[] = NAV_ITEMS): NavItem[] {
  return items.flatMap((item) => [item, ...flatNavItems(item.children ?? [])]);
}

/**
 * The item matching a path.
 * Prefers the longest match, so `/estatisticas/clinicas` beats
 * `/estatisticas`.
 */
export function navItemByPath(pathname: string): NavItem | undefined {
  return flatNavItems()
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
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
