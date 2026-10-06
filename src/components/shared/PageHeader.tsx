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
              <Link to={item.to} className="hover:text-primary-ink rounded-sm transition-colors">
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
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
  /** A badge next to the title, such as a record status. */
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  breadcrumb,
  badge,
  backTo,
  backLabel = "Voltar",
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn("relative isolate flex flex-wrap items-start justify-between gap-4", className)}
    >
      {/* Brand watermark: the outlined "s" in ink, fading out toward the title. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-1/2 max-w-xl overflow-hidden [mask-image:linear-gradient(to_left,black,transparent)] sm:block"
      >
        <div className="supera-pattern-ink [--pattern-opacity:0.14] [--pattern-w:8rem]" />
      </div>

      <div className="flex min-w-0 flex-col">
        {/* Back link and trail used to stack, and both said "Pacientes". One
            per screen size now: the trail on desktop, where it also names the
            current record; the back link on a phone, where a 40px target
            beats a 16px text link. */}
        {backTo && (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className={cn(
              "text-muted-foreground hover:text-foreground -ml-2 mb-1 h-10 w-fit gap-1 px-2 md:h-7",
              breadcrumb && "md:hidden",
            )}
          >
            <Link to={backTo}>
              <ArrowLeft size={14} aria-hidden="true" />
              {backLabel}
            </Link>
          </Button>
        )}

        {breadcrumb && (
          <Breadcrumb
            items={breadcrumb}
            className={cn("mb-1.5", backTo && "max-md:hidden")}
          />
        )}

        {eyebrow && (
          <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {eyebrow}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {badge}
        </div>

        {/* Short brand stroke under the title; it draws in once per screen. */}
        <span
          aria-hidden="true"
          className="from-primary to-chart-2 mt-2 h-0.5 w-10 rounded-full bg-linear-to-r motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:duration-500"
        />

        {subtitle && <p className="text-muted-foreground mt-2 text-sm leading-snug">{subtitle}</p>}
      </div>

      {/* The actions wrap instead of holding their row. On a phone the header
          already drops them under the title; a group that refused to shrink
          then ran past the screen edge, and the last button — "Desativar",
          "Editar" — was only reachable by scrolling the page sideways. */}
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export default PageHeader;
