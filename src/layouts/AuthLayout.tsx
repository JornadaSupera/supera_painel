import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Logo } from "@/components/shared";
import { BrandSurface } from "./BrandSurface";

/**
 * Frame for the authentication screens.
 *
 * Two columns on wide screens; on mobile the form sits under a slim brand
 * band. The left column carries the clinic identity on the brand surface — the
 * reference allows a logo and colour set in Settings.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-background grid min-h-dvh grid-rows-[auto_1fr] lg:grid-rows-1 lg:grid-cols-2">
      {/* ---------------------------------------------------- mobile brand band */}
      <BrandSurface className="flex items-center gap-3 px-6 pt-5 pb-6 [--pattern-w:9rem] lg:hidden">
        <Logo height={24} surface="marca" />
        <span className="border-l border-white/30 pl-3 font-semibold tracking-tight">
          Jornada Supera
        </span>
      </BrandSurface>

      {/* --------------------------------------------------------- identity */}
      <BrandSurface className="hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <Logo height={30} surface="marca" />
          <div className="flex flex-col border-l border-white/30 pl-3 leading-tight">
            <span className="font-semibold tracking-tight">Jornada Supera</span>
            <span className="text-xs text-white/85">Painel administrativo</span>
          </div>
        </div>

        {/* The card keeps the text off the pattern lines and holds white above AA. */}
        <div className="flex max-w-[42ch] flex-col gap-4 rounded-2xl border border-white/20 bg-black/25 p-7 shadow-xl backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-4 motion-safe:duration-500">
          <p className="text-2xl leading-snug font-semibold tracking-tight text-balance">
            Acompanhamento de quem está em tratamento, do cadastro à alta.
          </p>
          <p className="text-sm leading-relaxed text-white/85">
            Centro de Oncologia de Santa Catarina
          </p>
        </div>

        <p className="flex items-start gap-2 pb-2 text-xs leading-relaxed text-white/85">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Acesso restrito à equipe autorizada. Toda entrada é registrada em trilha de auditoria,
          conforme a Lei Geral de Proteção de Dados.
        </p>
      </BrandSurface>

      {/* ------------------------------------------------------------- form */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="flex w-full max-w-95 flex-col gap-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
            )}
          </div>

          {children}

          {footer && <div className="text-muted-foreground text-sm">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
