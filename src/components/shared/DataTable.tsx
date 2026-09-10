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
 * Data table used across the panel.
 *
 * Columns are declarative — the table knows nothing about the domain:
 *
 *   const columns: Column<Patient>[] = [
 *     { key: "name", header: "Paciente", sortable: true,
 *       render: (row) => <PatientCell patient={row} /> },
 *     { key: "cid", header: "CID", mono: true, width: 110 },
 *   ];
 *
 * Sorting and pagination are CONTROLLED: the caller holds the state and passes
 * it to `apiClient`. That is what lets us sort on the server without swapping
 * the component once Supabase is in place.
 */

export interface Column<T> {
  /** Also the sort field sent to the backend. */
  key: string;
  header: ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "right" | "center";
  /** Numbers, IDs, CPF and dates — they line up vertically across rows. */
  mono?: boolean;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Defaults to `row.id`. */
  getRowId?: (row: T) => string;
  loading?: boolean;
  error?: ErrorLike;
  onRetry?: () => void;
  sort?: Sort | null;
  onSortChange?: (sort: Sort) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Actions in the bar that appears once there is a selection. */
  bulkActions?: ReactNode;
  onRowClick?: (row: T) => void;
  density?: "comfortable" | "compact";
  pagination?: Omit<PaginationProps, "label">;
  emptyState?: ReactNode;
  /** Filters are applied — changes the empty-state copy. */
  filtered?: boolean;
  label?: string;
  /** Table description for screen readers. */
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
  filtered = false,
  label = "registros",
  caption,
  className,
}: DataTableProps<T>) {
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const visibleIds = data.map(getRowId);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id)) && !allSelected;

  const toggleAll = () => onSelectionChange?.(allSelected ? [] : visibleIds);

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange?.([...next]);
  };

  const sortBy = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return;

    const sameColumn = sort?.field === column.key;
    onSortChange({
      field: column.key,
      direction: sameColumn && sort?.direction === "asc" ? "desc" : "asc",
    });
  };

  const totalColumns = columns.length + (selectable ? 1 : 0);
  const alignment = (align?: Column<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : undefined;

  /* ----------------------------------------------------------------- states */

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
          columns={totalColumns}
          rows={pagination?.pageSize ? Math.min(pagination.pageSize, 8) : 8}
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={className}>
        {emptyState ?? <EmptyState variant={filtered ? "search" : "empty"} />}
      </div>
    );
  }

  /* ---------------------------------------------------------------- content */

  const cellPadding = density === "compact" ? "py-2" : "py-3";

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {selectable && selected.size > 0 && (
        <div className="bg-primary/10 border-primary/25 flex items-center justify-between gap-4 border-b px-5 py-3 text-sm">
          <span className="font-medium">
            {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
          </span>
          <div className="flex items-center gap-2">{bulkActions}</div>
        </div>
      )}

      {/* Horizontal scrolling stays INSIDE the table — the page body never
          scrolls sideways. */}
      <div className="min-w-0 overflow-x-auto">
        {/* The shadcn primitive uses `p-2` on every cell. The reference gives
            16px at the card edges and 12px between columns — the difference
            shows when the table meets the card border. */}
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          {caption && <caption className="sr-only">{caption}</caption>}

          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              {selectable && (
                <TableHead className="w-11">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Selecionar todos os registros desta página"
                  />
                </TableHead>
              )}

              {columns.map((column) => {
                const active = sort?.field === column.key;
                const Icon = !active ? ChevronsUpDown : sort?.direction === "asc" ? ArrowUp : ArrowDown;

                return (
                  <TableHead
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                    className={cn(
                      "text-muted-foreground h-9 text-[10px] font-medium tracking-wider whitespace-nowrap uppercase",
                      alignment(column.align),
                    )}
                    // Announces the sort state to assistive technology.
                    aria-sort={
                      active ? (sort?.direction === "asc" ? "ascending" : "descending") : undefined
                    }
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => sortBy(column)}
                        className={cn(
                          "hover:text-foreground inline-flex items-center gap-1 rounded-sm transition-colors",
                          active && "text-foreground",
                        )}
                      >
                        {column.header}
                        <Icon
                          size={13}
                          aria-hidden="true"
                          className={cn("shrink-0 opacity-40", active && "text-primary opacity-100")}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.map((row) => {
              const id = getRowId(row);
              const isSelected = selected.has(id);

              return (
                <TableRow
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  // A clickable row has to be reachable without a mouse.
                  // `role="button"` is not an option on a `<tr>`: it would
                  // replace the row semantics a screen reader uses to announce
                  // "row 3 of 20". tabIndex plus Enter/Space keeps the table a
                  // table and still makes the row operable from the keyboard.
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key !== "Enter" && event.key !== " ") return;
                          // Only when the row itself has focus. Without this,
                          // hitting Enter on a button inside the row would fire
                          // the button AND open the row.
                          if (event.target !== event.currentTarget) return;
                          // Space scrolls the page by default, which would jump
                          // the view instead of opening the record.
                          event.preventDefault();
                          onRowClick(row);
                        }
                      : undefined
                  }
                  className={cn(
                    onRowClick &&
                      "cursor-pointer focus-visible:outline-primary focus-visible:-outline-offset-2 focus-visible:outline-2",
                    // A selected row has a background AND a checked box —
                    // colour is not the only signal.
                    isSelected && "bg-primary/8 hover:bg-primary/12",
                  )}
                >
                  {selectable && (
                    <TableCell
                      className={cn("w-11", cellPadding)}
                      // Clicking the checkbox must not open the row.
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(id)}
                        aria-label="Selecionar registro"
                      />
                    </TableCell>
                  )}

                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        cellPadding,
                        column.mono && "font-mono text-xs",
                        alignment(column.align),
                        column.key === "actions" && "w-px text-right whitespace-nowrap",
                      )}
                    >
                      {column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "")}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pagination && <Pagination {...pagination} label={label} />}
    </div>
  );
}
