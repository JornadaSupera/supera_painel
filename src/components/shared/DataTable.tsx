import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Sort } from "@/services/contracts";
import { Pagination, type PaginationProps } from "./Pagination";
import { SkeletonTable } from "./Skeletons";
import { EmptyState, ErrorState, type ErrorLike } from "./StateBlock";

/**
 * Tabela de dados do painel.
 *
 * Colunas são declarativas — a tabela não sabe nada de domínio:
 *
 *   const colunas: Column<Paciente>[] = [
 *     { key: "nome", header: "Paciente", sortable: true,
 *       render: (row) => <CelulaPaciente paciente={row} /> },
 *     { key: "cid", header: "CID", mono: true, width: 110 },
 *   ];
 *
 * Ordenação e paginação são CONTROLADAS: quem usa mantém o estado e repassa
 * ao `apiClient`. É o que permite ordenar no servidor sem trocar de componente
 * quando o Supabase entrar.
 */

export interface Column<T> {
  /** Também é o campo de ordenação enviado ao backend. */
  key: string;
  header: ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "right" | "center";
  /** Números, IDs, CPF e datas — alinham na vertical entre linhas. */
  mono?: boolean;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Padrão: `row.id`. */
  getRowId?: (row: T) => string;
  loading?: boolean;
  error?: ErrorLike;
  onRetry?: () => void;
  sort?: Sort | null;
  onSortChange?: (sort: Sort) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Ações da barra que aparece quando há seleção. */
  bulkActions?: ReactNode;
  onRowClick?: (row: T) => void;
  density?: "comfortable" | "compact";
  pagination?: Omit<PaginationProps, "rotulo">;
  emptyState?: ReactNode;
  /** Há filtros aplicados — muda a copy do estado vazio. */
  filtrada?: boolean;
  rotulo?: string;
  /** Descrição da tabela para leitor de tela. */
  caption?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  getRowId = (row) => (row as { id: string }).id,
  loading = false,
  error = null,
  onRetry,
  sort,
  onSortChange,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions,
  onRowClick,
  density = "comfortable",
  pagination,
  emptyState,
  filtrada = false,
  rotulo = "registros",
  caption,
  className,
}: DataTableProps<T>) {
  const selecionados = useMemo(() => new Set(selectedIds), [selectedIds]);

  const idsVisiveis = data.map(getRowId);
  const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every((id) => selecionados.has(id));
  const algunsSelecionados = idsVisiveis.some((id) => selecionados.has(id)) && !todosSelecionados;

  const alternarTodos = () => onSelectionChange?.(todosSelecionados ? [] : idsVisiveis);

  const alternarLinha = (id: string) => {
    const proximos = new Set(selecionados);
    if (proximos.has(id)) proximos.delete(id);
    else proximos.add(id);
    onSelectionChange?.([...proximos]);
  };

  const ordenarPor = (coluna: Column<T>) => {
    if (!coluna.sortable || !onSortChange) return;

    const mesmaColuna = sort?.field === coluna.key;
    onSortChange({
      field: coluna.key,
      direction: mesmaColuna && sort?.direction === "asc" ? "desc" : "asc",
    });
  };

  const totalColunas = columns.length + (selectable ? 1 : 0);
  const alinhamento = (align?: Column<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : undefined;

  /* ---------------------------------------------------------------- estados */

  if (error) {
    return (
      <div className={className}>
        <ErrorState error={error} onRetry={onRetry} />
      </div>
    );
  }

  if (loading) {
    return (
      <div className={className}>
        <SkeletonTable
          colunas={totalColunas}
          linhas={pagination?.pageSize ? Math.min(pagination.pageSize, 8) : 8}
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        {emptyState ?? <EmptyState variant={filtrada ? "busca" : "vazio"} />}
      </div>
    );
  }

  /* --------------------------------------------------------------- conteúdo */

  const celula = density === "compact" ? "py-2" : "py-3";

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {selectable && selecionados.size > 0 && (
        <div className="bg-primary/10 border-primary/25 flex items-center justify-between gap-4 border-b px-5 py-3 text-sm">
          <span className="font-medium">
            {selecionados.size} {selecionados.size === 1 ? "selecionado" : "selecionados"}
          </span>
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}

      {/* A rolagem horizontal fica DENTRO da tabela — o corpo da página nunca
          rola na horizontal. */}
      <div className="min-w-0 overflow-x-auto">
        {/* O primitivo do shadcn usa `p-2` em toda célula. O protótipo respira
            16 px nas bordas do cartão e 12 px entre colunas — a diferença é
            visível quando a tabela encosta na borda do card. */}
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          {caption && <caption className="sr-only">{caption}</caption>}

          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {selectable && (
                <TableHead className="w-11">
                  <Checkbox
                    checked={todosSelecionados ? true : algunsSelecionados ? "indeterminate" : false}
                    onCheckedChange={alternarTodos}
                    aria-label="Selecionar todos os registros desta página"
                  />
                </TableHead>
              )}

              {columns.map((coluna) => {
                const ativo = sort?.field === coluna.key;
                const Icone = !ativo ? ChevronsUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;

                return (
                  <TableHead
                    key={coluna.key}
                    style={coluna.width ? { width: coluna.width } : undefined}
                    className={cn(
                      "text-muted-foreground h-9 text-[10px] font-medium tracking-wider whitespace-nowrap uppercase",
                      alinhamento(coluna.align),
                    )}
                    // Anuncia a ordenação para tecnologia assistiva.
                    aria-sort={
                      ativo ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined
                    }
                  >
                    {coluna.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => ordenarPor(coluna)}
                        className={cn(
                          "hover:text-foreground inline-flex items-center gap-1 rounded-sm transition-colors",
                          ativo && "text-foreground",
                        )}
                      >
                        {coluna.header}
                        <Icone
                          size={13}
                          aria-hidden="true"
                          className={cn("shrink-0 opacity-40", ativo && "text-primary opacity-100")}
                        />
                      </button>
                    ) : (
                      coluna.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.map((row) => {
              const id = getRowId(row);
              const estaSelecionada = selecionados.has(id);

              return (
                <TableRow
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    onRowClick && "cursor-pointer",
                    // Linha selecionada tem fundo E checkbox marcado — cor não
                    // é o único sinal.
                    estaSelecionada && "bg-primary/8 hover:bg-primary/12",
                  )}
                >
                  {selectable && (
                    <TableCell
                      className={cn("w-11", celula)}
                      // O clique no checkbox não deve abrir a linha.
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={estaSelecionada}
                        onCheckedChange={() => alternarLinha(id)}
                        aria-label="Selecionar registro"
                      />
                    </TableCell>
                  )}

                  {columns.map((coluna) => (
                    <TableCell
                      key={coluna.key}
                      className={cn(
                        celula,
                        coluna.mono && "font-mono text-xs",
                        alinhamento(coluna.align),
                        coluna.key === "acoes" && "w-px text-right whitespace-nowrap",
                      )}
                    >
                      {coluna.render ? coluna.render(row) : String((row as Record<string, unknown>)[coluna.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pagination && <Pagination {...pagination} rotulo={rotulo} />}
    </div>
  );
}
