import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

/**
 * Cabeçalho de página e trilha de navegação.
 */

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

/** O último item é sempre a página atual, e não vira link. */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Trilha de navegação"
      className={cn("text-muted-foreground flex items-center gap-2 text-xs", className)}
    >
      {items.map((item, i) => {
        const ultimo = i === items.length - 1;

        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-2">
            {i > 0 && <ChevronRight size={12} className="text-border" aria-hidden="true" />}

            {ultimo || !item.to ? (
              <span
                aria-current={ultimo ? "page" : undefined}
                className={cn(ultimo && "text-foreground font-medium")}
              >
                {item.label}
              </span>
            ) : (
              <Link to={item.to} className="hover:text-primary rounded-sm transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

/**
 * Pílula de nível do escopo contratado.
 *
 * O protótipo marca cada tela como MVP ou Médio. Reproduzimos porque o cliente
 * usa esse rótulo para conferir o que foi contratado — some da entrega final,
 * não da fase de construção.
 */
export function NivelBadge({
  nivel,
  className,
}: {
  nivel: "MVP" | "Médio";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap",
        nivel === "MVP"
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-supera-uniao/15 text-supera-uniao border-supera-uniao/25",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {nivel}
    </span>
  );
}

export interface PageHeaderProps {
  /**
   * Rótulo pequeno acima do título — a área do painel: "Painel executivo",
   * "Gestão", "Conteúdo". É o que o protótipo usa para situar a tela sem
   * repetir o item de menu.
   */
  eyebrow?: string;
  titulo: string;
  /**
   * Carrega contexto e contagem, como no protótipo:
   * "81 pacientes cadastrados · convite por SMS no cadastro".
   */
  subtitulo?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  nivel?: "MVP" | "Médio";
  /** Substitui a pílula de nível por um badge próprio. */
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  titulo,
  subtitulo,
  actions,
  breadcrumb,
  nivel,
  badge,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col">
        {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-1.5" />}

        {eyebrow && (
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {eyebrow}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{titulo}</h1>
          {badge ?? (nivel && <NivelBadge nivel={nivel} />)}
        </div>

        {subtitulo && (
          <p className="text-muted-foreground mt-1 text-sm leading-snug">{subtitulo}</p>
        )}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export default PageHeader;
