import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Page header and navigation trail.
 */

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

/** The last item is always the current page, and never becomes a link. */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Trilha de navegação"
      className={cn("text-muted-foreground flex items-center gap-2 text-xs", className)}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;

        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-2">
            {i > 0 && <ChevronRight size={12} className="text-border" aria-hidden="true" />}

            {isLast || !item.to ? (
              <span
                aria-current={isLast ? "page" : undefined}
                className={cn(isLast && "text-foreground font-medium")}
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
 * Scope-level pill.
 *
 * The reference screens mark each page as MVP or Médio. We reproduce it because
 * the client uses that label to check what was contracted — it disappears from
 * the final delivery, not from the build phase.
 */
export function LevelBadge({ level, className }: { level: "MVP" | "Médio"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap",
        level === "MVP"
          ? "bg-primary/10 text-primary border-primary/20"
          : "bg-supera-uniao/15 text-supera-uniao border-supera-uniao/25",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {level}
    </span>
  );
}

export interface PageHeaderProps {
  /**
   * Small label above the title — the panel area: "Painel executivo",
   * "Gestão", "Conteúdo". It is what the reference uses to place the screen
   * without repeating the menu item.
   */
  eyebrow?: string;
  title: string;
  /**
   * Carries context and counts, as in the reference:
   * "81 pacientes cadastrados · convite por SMS no cadastro".
   */
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
  /**
   * Destino do botão de voltar. Sem ele, o botão não aparece.
   *
   * Uma rota de detalhe pode ser alcançada por link direto, por atualização da
   * página ou por uma aba nova — situações em que o histórico do navegador não
   * tem para onde voltar. Por isso o botão navega para um destino declarado, e
   * não chama `history.back()`.
   */
  backTo?: string;
  /** Texto acessível do botão de voltar. */
  backLabel?: string;
  level?: "MVP" | "Médio";
  /** Replaces the level pill with a badge of your own. */
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  breadcrumb,
  level,
  badge,
  backTo,
  backLabel = "Voltar",
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col">
        {backTo && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-muted-foreground hover:text-foreground -ml-2 mb-1 h-7 w-fit gap-1 px-2"
          >
            <Link to={backTo}>
              <ArrowLeft size={14} aria-hidden="true" />
              {backLabel}
            </Link>
          </Button>
        )}

        {breadcrumb && <Breadcrumb items={breadcrumb} className="mb-1.5" />}

        {eyebrow && (
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {eyebrow}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{title}</h1>
          {badge ?? (level && <LevelBadge level={level} />)}
        </div>

        {subtitle && <p className="text-muted-foreground mt-1 text-sm leading-snug">{subtitle}</p>}
      </div>

      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export default PageHeader;
