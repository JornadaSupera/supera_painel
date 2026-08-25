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
 * NAVEGAÇÃO DO PAINEL
 * =============================================================================
 * Fonte única da sidebar, do breadcrumb e do título da página. Um item novo
 * entra aqui e aparece nos três lugares — nada de manter três listas em
 * sincronia na mão.
 *
 * As 9 telas correspondem exatamente às do protótipo.
 */

export interface ItemNavegacao {
  /** Rótulo na sidebar. */
  label: string;
  to: string;
  icon: LucideIcon;
  /** Sem permissão, o item não é renderizado — e a rota também é guardada. */
  permissao?: Permissao;
  /** Basta uma das permissões (OU lógico). Use no lugar de `permissao`. */
  alguma?: readonly Permissao[];
  /** Nível Médio do contrato — marcado na interface. */
  nivelMedio?: boolean;
  filhos?: ItemNavegacao[];
  /** Título da página; quando ausente, usa o `label`. */
  titulo?: string;
  /** Subtítulo do cabeçalho, quando fixo. */
  subtitulo?: string;
}

export const NAVEGACAO: ItemNavegacao[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    icon: LayoutDashboard,
    permissao: PERMISSAO.DASHBOARD_READ,
    titulo: "Dashboard executivo",
  },
  {
    label: "Pacientes",
    to: "/pacientes",
    icon: Users,
    permissao: PERMISSAO.PACIENTES_READ,
  },
  {
    label: "Usuários",
    to: "/usuarios",
    icon: UsersRound,
    permissao: PERMISSAO.USUARIOS_READ,
  },
  {
    label: "Conteúdo",
    to: "/conteudo",
    icon: FileText,
    permissao: PERMISSAO.CONTEUDO_READ,
    titulo: "Aprovação de conteúdo",
    subtitulo: "Workflow editorial",
  },
  {
    label: "Relatórios",
    to: "/relatorios",
    icon: ClipboardList,
    permissao: PERMISSAO.RELATORIOS_READ,
    subtitulo: "12 relatórios pré-definidos",
  },
  {
    label: "Estatísticas",
    to: "/estatisticas",
    icon: TrendingUp,
    nivelMedio: true,
    alguma: [
      PERMISSAO.ESTATISTICAS_CLINICAS_READ,
      PERMISSAO.ESTATISTICAS_READ_ALL,
      PERMISSAO.ESTATISTICAS_READ_SELF,
    ],
    filhos: [
      {
        label: "Clínicas",
        to: "/estatisticas/clinicas",
        icon: TrendingUp,
        permissao: PERMISSAO.ESTATISTICAS_CLINICAS_READ,
        nivelMedio: true,
        titulo: "Estatísticas clínicas",
        subtitulo: "Cruzamento Protocolo × Efeito × Grau",
      },
      {
        label: "Operacionais",
        to: "/estatisticas/operacionais",
        icon: TrendingUp,
        alguma: [PERMISSAO.ESTATISTICAS_READ_ALL, PERMISSAO.ESTATISTICAS_READ_SELF],
        nivelMedio: true,
        titulo: "Estatísticas operacionais",
        subtitulo: "Operação da clínica",
      },
    ],
  },
  {
    label: "Auditoria & logs",
    to: "/auditoria",
    icon: ScrollText,
    permissao: PERMISSAO.AUDITORIA_READ,
    nivelMedio: true,
    titulo: "Auditoria & logs",
    subtitulo: "Rastro de acesso a dados sensíveis · retenção de 5 anos",
  },
  {
    label: "Configurações",
    to: "/configuracoes",
    icon: Settings,
    permissao: PERMISSAO.CONFIGURACOES_READ,
  },
];

/** Todos os itens em lista plana, pais e filhos. */
export function itensPlanos(itens: ItemNavegacao[] = NAVEGACAO): ItemNavegacao[] {
  return itens.flatMap((item) => [item, ...itensPlanos(item.filhos ?? [])]);
}

/**
 * Item correspondente a um caminho.
 * Prefere a correspondência mais longa, para que `/estatisticas/clinicas`
 * ganhe de `/estatisticas`.
 */
export function itemPorCaminho(pathname: string): ItemNavegacao | undefined {
  return itensPlanos()
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0];
}

/** Trilha de navegação a partir do caminho atual. */
export function trilhaPorCaminho(pathname: string): ItemNavegacao[] {
  const trilha: ItemNavegacao[] = [];

  for (const pai of NAVEGACAO) {
    if (pathname === pai.to || pathname.startsWith(`${pai.to}/`)) {
      trilha.push(pai);

      const filho = pai.filhos?.find(
        (f) => pathname === f.to || pathname.startsWith(`${f.to}/`),
      );
      if (filho) trilha.push(filho);

      break;
    }
  }

  return trilha;
}
