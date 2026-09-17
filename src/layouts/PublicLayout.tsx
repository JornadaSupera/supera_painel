import { Activity, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

/** The six brand values, in the order the identity presents them. */
const BRAND_RIBBON = [
  "bg-supera-uniao",
  "bg-supera-empatia",
  "bg-supera-seguranca",
  "bg-supera-respeito",
  "bg-supera-perfeicao",
  "bg-supera-amor",
] as const;

/**
 * Frame for public pages reached by people who are not panel users — patients
 * and caregivers following a link from the app's e-mails.
 *
 * Deliberately free of any panel reference: no "administrative" label, no
 * sign-in link, nothing that suggests there is something else to reach from
 * here. Mobile first, because an e-mail link is almost always opened on a phone.
 */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background relative isolate flex min-h-dvh flex-col overflow-hidden">
      <div className="flex h-1.5 w-full" aria-hidden="true">
        {BRAND_RIBBON.map((color) => (
          <span key={color} className={`${color} flex-1`} />
        ))}
      </div>

      {/* Ambient light in brand colours. Decorative only. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="bg-supera-uniao/20 absolute -top-40 -right-32 size-[26rem] rounded-full blur-3xl" />
        <div className="bg-supera-empatia/20 absolute -bottom-48 -left-40 size-[30rem] rounded-full blur-3xl" />
      </div>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10 sm:py-16">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="bg-primary text-primary-foreground shadow-primary/25 flex size-12 items-center justify-center rounded-2xl shadow-lg">
            <Activity size={26} aria-hidden="true" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-tight">Jornada Supera</span>
            <span className="text-muted-foreground text-xs">
              Centro de Oncologia de Santa Catarina
            </span>
          </div>
        </header>

        <div className="bg-card/95 border-border shadow-primary/5 w-full max-w-md rounded-2xl border p-6 shadow-xl backdrop-blur-sm sm:p-8">
          {children}
        </div>

        <p className="text-muted-foreground max-w-md text-center text-xs leading-relaxed text-balance">
          <ShieldCheck
            size={14}
            className="text-primary mr-1.5 inline-block -translate-y-px align-middle"
            aria-hidden="true"
          />
          Conexão segura. Seus dados são protegidos conforme a LGPD.
        </p>
      </main>
    </div>
  );
}

export default PublicLayout;
