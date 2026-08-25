import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Esqueletos com a FORMA do conteúdo final.
 *
 * Spinner genérico esconde a estrutura e faz a página "pular" quando os dados
 * chegam. O esqueleto reserva o espaço certo desde o primeiro frame.
 *
 * Os blocos são decorativos; o container carrega `aria-busy` e o texto em
 * `sr-only` para quem usa leitor de tela.
 */

export interface SkeletonTableProps {
  linhas?: number;
  colunas?: number;
  /** `grid-template-columns`; por padrão colunas iguais. */
  template?: string;
  className?: string;
}

export function SkeletonTable({ linhas = 8, colunas = 5, template, className }: SkeletonTableProps) {
  const grid = { gridTemplateColumns: template ?? `repeat(${colunas}, 1fr)` };

  return (
    <div className={cn("w-full", className)} aria-busy="true">
      <div className="border-border grid items-center gap-4 border-b px-5 py-3" style={grid}>
        {Array.from({ length: colunas }, (_, i) => (
          <Skeleton key={i} className="h-2.5 w-3/5" />
        ))}
      </div>

      {Array.from({ length: linhas }, (_, linha) => (
        <div
          key={linha}
          className="border-border grid h-14 items-center gap-4 border-b px-5 last:border-b-0"
          style={grid}
        >
          {Array.from({ length: colunas }, (_, coluna) => (
            <Skeleton
              key={coluna}
              className="h-3"
              // Larguras variadas evitam o efeito de "grade perfeita", que não
              // se parece com dado de verdade.
              style={{ width: coluna === 0 ? "85%" : `${45 + ((linha + coluna) % 4) * 12}%` }}
            />
          ))}
        </div>
      ))}

      <span className="sr-only">Carregando registros</span>
    </div>
  );
}

export function SkeletonCards({ quantidade = 4, className }: { quantidade?: number; className?: string }) {
  return (
    <div
      className={cn("grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]", className)}
      aria-busy="true"
    >
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} className="border-border bg-card flex flex-col gap-3 rounded-lg border p-5">
          <Skeleton className="h-2.5 w-2/5" />
          <Skeleton className="h-8 w-3/5" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      ))}
      <span className="sr-only">Carregando indicadores</span>
    </div>
  );
}

export function SkeletonChart({ barras = 7, className }: { barras?: number; className?: string }) {
  return (
    <div className={cn("flex h-55 items-end gap-3 p-5", className)} aria-busy="true">
      {Array.from({ length: barras }, (_, i) => (
        <Skeleton
          key={i}
          className="flex-1 rounded-b-none"
          style={{ height: `${35 + ((i * 37) % 60)}%` }}
        />
      ))}
      <span className="sr-only">Carregando gráfico</span>
    </div>
  );
}

export function SkeletonForm({ campos = 5, className }: { campos?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-5", className)} aria-busy="true">
      {Array.from({ length: campos }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-9 rounded-md" />
        </div>
      ))}
      <span className="sr-only">Carregando formulário</span>
    </div>
  );
}
