import {
  BellRing,
  CalendarDays,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Especialidade } from "@/lib/enums";
import type { NavItem } from "./navigation";

/**
 * CLINICAL PANEL NAVIGATION
 * =============================================================================
 * Mirrors `navigation.ts`, but the six items are the same regardless of who is
 * logged in — only the `:especialidade` segment of every `to` changes. That is
 * why this is a function and not a constant list like `NAV_ITEMS`: the routes
 * only exist once we know which specialty is asking.
 *
 * Matches the six routes found in the clinical prototype
 * (`clinico/{especialidade}/…`), in the prototype's order — see PA-07.
 */
export function clinicoNavItems(especialidade: Especialidade): NavItem[] {
  const base = `/clinico/${especialidade}`;

  return [
    {
      label: "Dashboard",
      to: base,
      icon: LayoutDashboard,
      title: "Painel do dia",
    },
    {
      label: "Pacientes",
      to: `${base}/pacientes`,
      icon: Users,
      title: "Carteira de pacientes",
    },
    {
      label: "Chat",
      to: `${base}/chat`,
      icon: MessageSquare,
    },
    {
      label: "Conteúdo",
      to: `${base}/conteudo`,
      icon: FileText,
      title: "Minhas orientações",
    },
    {
      label: "Alertas",
      to: `${base}/alertas`,
      icon: BellRing as LucideIcon,
      title: "Fila de alertas",
    },
    {
      label: "Agenda",
      to: `${base}/agenda`,
      icon: CalendarDays,
    },
  ];
}
