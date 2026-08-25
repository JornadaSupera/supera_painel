import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cartão de gráfico do painel.
 *
 * Estrutura do protótipo: `rounded-2xl border bg-card p-5`, cabeçalho com
 * título pequeno e semibold, descrição em 11 px, gráfico com altura fixa de
 * 220 px.
 *
 * Separado do `Card` do shadcn de propósito: o `Card` traz `gap-6` e blocos de
 * padding próprios, pensados para conteúdo de texto. Aqui o gráfico precisa
 * encostar nas bordas do padding, sem espaçamento extra entre header e corpo.
 */
export interface ChartCardProps {
  titulo: string;
  descricao?: ReactNode;
  /** Ações no canto do cabeçalho — filtro, alternador de visualização. */
  acoes?: ReactNode;
  /** Ocupa duas colunas na grade de três. */
  largo?: boolean;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  titulo,
  descricao,
  acoes,
  largo = false,
  className,
  children,
}: ChartCardProps) {
  return (
    <section
      className={cn("bg-card rounded-2xl border p-5", largo && "lg:col-span-2", className)}
    >
      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {descricao && <p className="text-muted-foreground text-[11px]">{descricao}</p>}
        </div>
        {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
      </header>

      {children}
    </section>
  );
}

export default ChartCard;
