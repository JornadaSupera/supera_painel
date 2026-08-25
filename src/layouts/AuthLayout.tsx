import { Activity, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Moldura das telas de autenticação.
 *
 * Duas colunas em telas largas; só o formulário no mobile. A coluna da
 * esquerda carrega a identidade da clínica — o protótipo prevê logo e cor
 * configuráveis em Configurações.
 */
export function AuthLayout({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <div className="bg-background grid min-h-dvh lg:grid-cols-2">
      {/* ------------------------------------------------------- identidade */}
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

      {/* -------------------------------------------------------- formulário */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="flex w-full max-w-95 flex-col gap-8">
          {/* Marca aparece no topo apenas quando a coluna lateral está oculta. */}
          <div className="flex items-center gap-3 lg:hidden">
            <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
              <Activity size={20} aria-hidden="true" />
            </span>
            <span className="font-semibold tracking-tight">Jornada Supera</span>
          </div>

          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
            {descricao && (
              <p className="text-muted-foreground text-sm leading-relaxed">{descricao}</p>
            )}
          </div>

          {children}

          {rodape && <div className="text-muted-foreground text-sm">{rodape}</div>}
        </div>
      </main>
    </div>
  );
}

export default AuthLayout;
