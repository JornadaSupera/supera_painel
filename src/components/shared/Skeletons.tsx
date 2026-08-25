import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Skeletons shaped like the final content.
 *
 * A generic spinner hides the structure and makes the page jump once the data
 * arrives. A skeleton reserves the right space from the first frame.
 *
 * The blocks are decorative; the container carries `aria-busy` and the
 * `sr-only` text for anyone using a screen reader.
 */

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  /** `grid-template-columns`; equal columns by default. */
  template?: string;
  className?: string;
}

export function SkeletonTable({ rows = 8, columns = 5, template, className }: SkeletonTableProps) {
  const grid = { gridTemplateColumns: template ?? `repeat(${columns}, 1fr)` };

  return (
    <div className={cn("w-full", className)} aria-busy="true">
      <div className="border-border grid items-center gap-4 border-b px-5 py-3" style={grid}>
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-2.5 w-3/5" />
        ))}
      </div>

      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="border-border grid h-14 items-center gap-4 border-b px-5 last:border-b-0"
          style={grid}
        >
          {Array.from({ length: columns }, (_, column) => (
            <Skeleton
              key={column}
              className="h-3"
              // Varied widths avoid the "perfect grid" effect, which looks
              // nothing like real data.
              style={{ width: column === 0 ? "85%" : `${45 + ((row + column) % 4) * 12}%` }}
            />
          ))}
        </div>
      ))}

      <span className="sr-only">Carregando registros</span>
    </div>
  );
}

export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]", className)}
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
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

export function SkeletonChart({ bars = 7, className }: { bars?: number; className?: string }) {
  return (
    <div className={cn("flex h-55 items-end gap-3 p-5", className)} aria-busy="true">
      {Array.from({ length: bars }, (_, i) => (
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

export function SkeletonForm({ fields = 5, className }: { fields?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-5", className)} aria-busy="true">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="h-9 rounded-md" />
        </div>
      ))}
      <span className="sr-only">Carregando formulário</span>
    </div>
  );
}
