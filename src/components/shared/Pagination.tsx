import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS, paginationMeta } from "@/services/contracts";

/**
 * Pagination bar.
 *
 * It works from `count` — the unpaginated total that comes with the data
 * contract. That is what produces "Exibindo 1–20 de 81".
 */

/**
 * Page sequence with ellipses.
 * It always shows the first page, the last one and a window around the current
 * one, so the bar does not change width as you navigate.
 */
function pageSequence(current: number, total: number, window = 1): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  for (let i = 1; i <= window; i += 1) {
    if (current - i > 1) pages.add(current - i);
    if (current + i < total) pages.add(current + i);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "…")[] = [];

  sorted.forEach((page, i) => {
    const previous = sorted[i - 1];
    if (previous !== undefined && page - previous > 1) result.push("…");
    result.push(page);
  });

  return result;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** "pacientes", "registros"… */
  label?: string;
  className?: string;
}

const BUTTON =
  "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-7.5 min-w-7.5 items-center justify-center rounded-sm border border-transparent px-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export function Pagination({
  page,
  pageSize,
  count,
  onPageChange,
  onPageSizeChange,
  label = "registros",
  className,
}: PaginationProps) {
  const meta = paginationMeta({ page, pageSize, count });

  if (count === 0) return null;

  const goTo = (target: number) => {
    if (target >= 1 && target <= meta.totalPages && target !== page) onPageChange(target);
  };

  return (
    <nav
      aria-label="Paginação"
      className={cn("border-border flex flex-wrap items-center justify-between gap-4 border-t px-5 py-3", className)}
    >
      <p className="text-muted-foreground text-xs">
        Exibindo <span className="text-foreground font-mono font-medium">{meta.firstItem}</span>–
        <span className="text-foreground font-mono font-medium">{meta.lastItem}</span> de{" "}
        <span className="text-foreground font-mono font-medium">{count.toLocaleString("pt-BR")}</span>{" "}
        {label}
      </p>

      <div className="flex items-center gap-4">
        {onPageSizeChange && (
          <label className="text-muted-foreground flex items-center gap-2 text-xs">
            Por página
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="border-input bg-card text-foreground h-7.5 cursor-pointer rounded-sm border px-2 text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={BUTTON}
            onClick={() => goTo(page - 1)}
            disabled={!meta.hasPrev}
            aria-label="Página anterior"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>

          {pageSequence(page, meta.totalPages).map((item, i) =>
            item === "…" ? (
              <span
                key={`gap-${i}`}
                aria-hidden="true"
                className="text-muted-foreground flex h-7.5 min-w-5 items-center justify-center select-none"
              >
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => goTo(item)}
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  BUTTON,
                  item === page &&
                    "bg-primary text-primary-foreground border-primary hover:bg-primary hover:text-primary-foreground font-medium",
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className={BUTTON}
            onClick={() => goTo(page + 1)}
            disabled={!meta.hasNext}
            aria-label="Próxima página"
          >
            <ChevronRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </nav>
  );
}
