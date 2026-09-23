import {
  ArrowUp,
  CalendarDays,
  ChevronDown,
  Moon,
  Printer,
  ScrollText,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { Logo } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { BrandRibbon } from "@/layouts/BrandRibbon";
import { formatLongDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/theme";
import { CONTROLLER } from "../content/controller";
import { useActiveSection } from "../hooks/useActiveSection";
import type { LegalDocument } from "../types";
import { LegalBlockView } from "./LegalBlockView";
import { TableOfContents } from "./TableOfContents";

/**
 * Public page for one legal document — the terms of use or the privacy policy.
 *
 * Reachable without a session: app stores, the patient app and the sign-in
 * screen all link here. Like the other public frames it carries no reference to
 * the panel, so nothing on it suggests there is more to reach from here.
 */

const DOCUMENTS = [
  { to: "/termos", label: "Termos de Uso", icon: ScrollText },
  { to: "/privacidade", label: "Política de Privacidade", icon: ShieldCheck },
] as const;

/** Arriving with `#section` in the address: the SPA renders after the browser
    tried to scroll, so the jump is done here once the text exists. Changing
    document starts from the top. */
function useScrollOnArrival(slug: string) {
  const { hash } = useLocation();

  useEffect(() => {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo({ top: 0 });
    // Only on arrival and on document change — in-page anchor clicks scroll natively.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);
}

function ThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const dark =
    theme === "dark" || (theme === "system" && document.documentElement.classList.contains("dark"));
  const Icon = dark ? Sun : Moon;

  return (
    <HeroIconButton label={dark ? "Usar tema claro" : "Usar tema escuro"} onClick={toggleTheme}>
      <Icon />
    </HeroIconButton>
  );
}

function HeroIconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="border border-current/20 bg-current/5 text-inherit hover:bg-current/15 hover:text-inherit"
    >
      {children}
    </Button>
  );
}

export function LegalDocumentView({ document: legal }: { document: LegalDocument }) {
  useDocumentTitle(legal.documentTitle);
  useScrollOnArrival(legal.slug);

  const sectionIds = useMemo(() => legal.sections.map((section) => section.id), [legal]);
  const activeId = useActiveSection(sectionIds);
  const other = DOCUMENTS.find((item) => item.to !== `/${legal.slug}`);

  return (
    <div id="topo" className="bg-background text-foreground min-h-dvh">
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>

      <BrandRibbon />

      {/* ------------------------------------------------------------ hero */}
      <header className="bg-supera-perfeicao text-primary-foreground dark:bg-sidebar dark:text-foreground relative isolate overflow-hidden print:bg-transparent print:text-inherit">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 no-print">
          <div className="bg-supera-uniao/35 absolute -top-32 -right-24 size-[28rem] rounded-full blur-3xl" />
          <div className="bg-supera-empatia/20 absolute -bottom-40 left-[-10rem] size-[24rem] rounded-full blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-8 sm:pt-8 sm:pb-14">
          <div className="flex items-center justify-between gap-4">
            <Link to={`/${legal.slug}`} className="flex items-center gap-3">
              <Logo height={32} surface="escura" />
              <span className="flex flex-col leading-tight">
                <span className="font-semibold tracking-tight">Jornada Supera</span>
                <span className="text-xs opacity-70">{CONTROLLER.shortName}</span>
              </span>
            </Link>

            <div className="no-print flex items-center gap-2">
              <HeroIconButton label="Imprimir ou salvar em PDF" onClick={() => window.print()}>
                <Printer />
              </HeroIconButton>
              <ThemeToggle />
            </div>
          </div>

          <p className="mt-12 text-2xs font-semibold tracking-[0.22em] uppercase opacity-70">
            Documento legal
          </p>
          <h1 className="mt-3 text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl">
            {legal.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-balance opacity-80 sm:text-lg">
            {legal.summary}
          </p>

          <p className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-current/20 bg-current/5 px-3 py-1 text-xs">
            <CalendarDays size={14} aria-hidden="true" className="opacity-80" />
            Vigente desde {formatLongDate(legal.effectiveAt)}
          </p>

          <nav aria-label="Documentos legais" className="no-print mt-8">
            <ul className="inline-flex flex-wrap gap-1 rounded-full border border-current/20 bg-current/5 p-1">
              {DOCUMENTS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-card text-foreground shadow-sm"
                          : "opacity-80 hover:bg-current/10 hover:opacity-100",
                      )
                    }
                  >
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <main id="conteudo" className="relative mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          {/* ------------------------------------------ table of contents */}
          <aside className="no-print hidden lg:block">
            <nav aria-label="Nesta página" className="sticky top-6">
              <p className="text-muted-foreground mb-3 px-3 text-xs font-semibold tracking-wider uppercase">
                Nesta página
              </p>
              <TableOfContents sections={legal.sections} activeId={activeId} />
              <a
                href="#topo"
                className="text-muted-foreground hover:text-foreground mt-4 flex items-center gap-2 px-3 text-sm transition-colors"
              >
                <ArrowUp size={14} aria-hidden="true" />
                Voltar ao topo
              </a>
            </nav>
          </aside>

          {/* ---------------------------------------------------- article */}
          <article className="bg-card border-border rounded-2xl border p-6 sm:p-10">
            <details className="no-print border-border group mb-8 rounded-xl border lg:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold">
                Nesta página
                <ChevronDown
                  size={16}
                  className="transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <nav aria-label="Nesta página" className="px-1 pb-3">
                <TableOfContents sections={legal.sections} activeId={activeId} />
              </nav>
            </details>

            <div className="space-y-12">
              {legal.sections.map((section, index) => (
                <section
                  key={section.id}
                  id={section.id}
                  aria-labelledby={`${section.id}-titulo`}
                  className="scroll-mt-6"
                >
                  <h2
                    id={`${section.id}-titulo`}
                    className="flex items-baseline gap-3 text-xl font-semibold tracking-tight text-balance"
                  >
                    <span className="text-primary font-mono text-sm tabular-nums">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <a href={`#${section.id}`} className="hover:text-primary transition-colors">
                      {section.title}
                    </a>
                  </h2>
                  <div className="text-foreground/85 mt-4 space-y-4 text-[0.9375rem] leading-7">
                    {section.blocks.map((block, blockIndex) => (
                      <LegalBlockView key={blockIndex} block={block} />
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <footer className="border-border text-muted-foreground mt-12 border-t pt-6 text-sm">
              {legal.title} · versão {legal.version} · vigente desde{" "}
              {formatLongDate(legal.effectiveAt)}.
            </footer>
          </article>
        </div>

        {/* ------------------------------------------------- see also */}
        {other && (
          <Link
            to={other.to}
            className="no-print bg-card border-border hover:border-primary/50 group mt-8 flex items-center gap-4 rounded-2xl border p-5 transition-colors sm:p-6"
          >
            <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
              <other.icon size={22} aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="text-muted-foreground block text-xs font-medium tracking-wider uppercase">
                Veja também
              </span>
              <span className="group-hover:text-primary block font-semibold transition-colors">
                {other.label}
              </span>
            </span>
            <ArrowUp size={18} className="text-muted-foreground rotate-45" aria-hidden="true" />
          </Link>
        )}
      </main>

      <footer className="border-border text-muted-foreground border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {new Date().getFullYear()} {CONTROLLER.name} · CNPJ{" "}
            <span className="font-mono">{CONTROLLER.taxId}</span>
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-primary" aria-hidden="true" />
            Conexão segura. Seus dados são protegidos conforme a LGPD.
          </p>
        </div>
      </footer>
    </div>
  );
}
