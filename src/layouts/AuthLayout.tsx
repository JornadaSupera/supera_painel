import { Activity, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Frame for the authentication screens.
 *
 * Two columns on wide screens; the form alone on mobile. The left column
 * carries the clinic identity — the reference allows a logo and colour set in
 * Settings.
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
    <div className="bg-background grid min-h-dvh lg:grid-cols-2">
      {/* --------------------------------------------------------- identity */}
      <aside className="bg-sidebar border-sidebar-border hidden flex-col justify-between border-r p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <Activity size={20} aria-hidden="true" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold tracking-tight">Jornada Supera</span>
            <span className="text-muted-foreground text-xs">Painel administrativo</span>
          </div>
        </div>

        <div className="flex max-w-[42ch] flex-col gap-4">
          <p className="text-2xl leading-snug font-semibold tracking-tight text-balance">
            Acompanhamento de quem está em tratamento, do cadastro à alta.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Centro de Oncologia de Santa Catarina
          </p>
        </div>

        <p className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed">
          <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          Acesso restrito à equipe autorizada. Toda entrada é registrada em trilha de auditoria,
          conforme a Lei Geral de Proteção de Dados.
        </p>
      </aside>

      {/* ------------------------------------------------------------- form */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="flex w-full max-w-95 flex-col gap-8">
          {/* The brand shows at the top only when the side column is hidden. */}
          <div className="flex items-center gap-3 lg:hidden">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
              <Activity size={20} aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-tight">Jornada Supera</span>
          </div>

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
