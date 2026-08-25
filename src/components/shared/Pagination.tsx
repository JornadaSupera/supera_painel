import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS, paginationMeta } from "@/services/contracts";

/**
 * Barra de paginação.
 *
 * Trabalha com `count` — o total sem paginação, que vem do contrato de dados.
 * É o que produz "Exibindo 1–20 de 81".
 */

/**
 * Sequência de páginas com reticências.
 * Sempre mostra a primeira, a última e uma janela ao redor da atual, para que a
 * barra não mude de largura conforme se navega.
 */
function sequencia(atual: number, total: number, janela = 1): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const paginas = new Set<number>([1, total, atual]);
  for (let i = 1; i <= janela; i += 1) {
    if (atual - i > 1) paginas.add(atual - i);
    if (atual + i < total) paginas.add(atual + i);
  }

  const ordenadas = [...paginas].sort((a, b) => a - b);
  const resultado: (number | "…")[] = [];

  ordenadas.forEach((pagina, i) => {
    const anterior = ordenadas[i - 1];
    if (anterior !== undefined && pagina - anterior > 1) resultado.push("…");
    resultado.push(pagina);
  });

  return resultado;
}

export interface PaginationProps {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** "pacientes", "registros"… */
  rotulo?: string;
  className?: string;
}

const BOTAO =
  "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-7.5 min-w-7.5 items-center justify-center rounded-sm border border-transparent px-2 font-mono text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

export function Pagination({
  page,
  pageSize,
  count,
  onPageChange,
  onPageSizeChange,
  rotulo = "registros",
  className,
}: PaginationProps) {
  const meta = paginationMeta({ page, pageSize, count });

  if (count === 0) return null;

  const irPara = (destino: number) => {
    if (destino >= 1 && destino <= meta.totalPages && destino !== page) onPageChange(destino);
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
        {rotulo}
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
              {PAGE_SIZE_OPTIONS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            className={BOTAO}
            onClick={() => irPara(page - 1)}
            disabled={!meta.hasPrev}
            aria-label="Página anterior"
          >
            <ChevronLeft size={15} aria-hidden="true" />
          </button>

          {sequencia(page, meta.totalPages).map((item, i) =>
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
                onClick={() => irPara(item)}
                aria-label={`Página ${item}`}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  BOTAO,
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
            className={BOTAO}
            onClick={() => irPara(page + 1)}
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
