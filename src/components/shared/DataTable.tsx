import { ArrowDown, ArrowDownUp, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, type KeyboardEvent, type ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import type { Sort, SortDirection } from "@/services/contracts";
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
  /**
   * Also the sort field sent to the backend. The key `"actions"` marks the row
   * menu: kept narrow on the right of the table, and in the card corner on a
   * phone.
   */
  key: string;
  header: ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "right" | "center";
  /** Numbers, IDs, CPF and dates — they line up vertically across rows. */
  mono?: boolean;
  /**
   * Leaves the table below this breakpoint. For secondary columns only: the
   * ones that make a laptop scroll sideways to reach the status and the row
   * actions. The phone card still lists them — it has the height to spare.
   */
  hideBelow?: "lg" | "xl";
  render?: (row: T) => ReactNode;
}

const ACTIONS_KEY = "actions";

/* Literal classes, so Tailwind finds them when it scans the source. */
const HIDE_BELOW: Record<NonNullable<Column<unknown>["hideBelow"]>, string> = {
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

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
  /**
   * Row selection, as ONE object.
   *
   * It used to be four independent props, and three of the combinations they
   * allowed were broken states the compiler accepted: `selectable` without
   * `onChange` rendered checkboxes that could be ticked and changed nothing
   * (the handlers used optional chaining), `selectedIds` without `selectable`
   * held a selection nobody could see, and bulk actions without a selection
   * had no bar to live in. Passing the object means the table cannot offer a
   * control it will not honour.
   */
  selection?: {
    ids: string[];
    onChange: (ids: string[]) => void;
    /** Actions in the bar that appears once there is a selection. */
    actions?: ReactNode;
  };
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
  selection,
  onRowClick,
  density = "comfortable",
  pagination,
  emptyState,
  filtered = false,
  label = "registros",
  caption,
  className,
}: DataTableProps<T>) {
  const selecionavel = selection !== undefined;
  const selected = useMemo(() => new Set(selection?.ids ?? []), [selection?.ids]);

  const visibleIds = data.map(getRowId);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const someSelected = visibleIds.some((id) => selected.has(id)) && !allSelected;

  const toggleAll = () => selection?.onChange(allSelected ? [] : visibleIds);

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection?.onChange([...next]);
  };

  const sortBy = (column: Column<T>) => {
    if (!column.sortable || !onSortChange) return;

    const sameColumn = sort?.field === column.key;
    onSortChange({
      field: column.key,
      direction: sameColumn && sort?.direction === "asc" ? "desc" : "asc",
    });
  };

  const totalColumns = columns.length + (selecionavel ? 1 : 0);
  const alignment = (align?: Column<T>["align"]) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : undefined;

  const cardLayout = !useMediaQuery(BREAKPOINT.md);

  /* -----------------------------------------------------------------
     STATES — precedence: error, then loading, then empty.

     The same order as `ChartFrame` in `Charts.tsx`, and the two used to
     disagree: the chart checked loading first. A failed read being retried then
     showed a skeleton in the chart and an error in the table, on one screen,
     about one request.
     ----------------------------------------------------------------- */

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

  const selectionBar = selecionavel && selected.size > 0 && (
    <div className="bg-primary/10 border-primary/25 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-5 py-3 text-sm">
      <span className="font-medium">
        {selected.size} {selected.size === 1 ? "selecionado" : "selecionados"}
      </span>
      <div className="flex flex-wrap items-center gap-2">{selection?.actions}</div>
    </div>
  );

  const rowActivation = (row: T) =>
    onRowClick
      ? {
          onClick: () => onRowClick(row),
          // A clickable row has to be reachable without a mouse.
          // `role="button"` is not an option on a `<tr>`: it would replace the
          // row semantics a screen reader uses to announce "row 3 of 20".
          // tabIndex plus Enter/Space keeps the table a table and still makes
          // the row operable from the keyboard.
          tabIndex: 0,
          onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            // Only when the row itself has focus. Without this, hitting Enter
            // on a button inside the row would fire the button AND open the
            // row.
            if (event.target !== event.currentTarget) return;
            // Space scrolls the page by default, which would jump the view
            // instead of opening the record.
            event.preventDefault();
            onRowClick(row);
          },
        }
      : {};

  const rowFocus =
    onRowClick &&
    "cursor-pointer focus-visible:outline-primary focus-visible:-outline-offset-2 focus-visible:outline-2";

  const cell = (column: Column<T>, row: T) =>
    column.render ? column.render(row) : String((row as Record<string, unknown>)[column.key] ?? "");

  /* ------------------------------------------------------------ phone cards */

  /*
   * Below `md` a table only fits its first two or three columns, and the ones
   * that matter — status, the row menu, "when" — end up past the edge behind a
   * scrollbar nobody notices. Each row becomes a card instead: the first
   * column as the title, the row menu in the corner, everything else as
   * label/value pairs. The column definitions stay the same, so no screen has
   * to describe its rows twice.
   */
  if (cardLayout) {
    const [titleColumn, ...rest] = columns;
    const actionsColumn = rest.find((column) => column.key === ACTIONS_KEY);
    const fields = rest.filter((column) => column !== actionsColumn);

    return (
      <div className={cn("flex min-w-0 flex-col", className)}>
        {selectionBar}

        {onSortChange && <CardSort columns={columns} sort={sort} onSortChange={onSortChange} />}

        <ul aria-label={caption} className="divide-border divide-y">
          {data.map((row) => {
            const id = getRowId(row);
            const isSelected = selected.has(id);

            return (
              <li
                key={id}
                {...rowActivation(row)}
                className={cn(
                  "flex flex-col gap-3 px-4",
                  density === "compact" ? "py-2.5" : "py-3.5",
                  rowFocus,
                  isSelected && "bg-primary/8",
                )}
              >
                <div className="flex items-start gap-3">
                  {selecionavel && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label="Selecionar registro"
                      className="mt-0.5"
                    />
                  )}

                  <div className="min-w-0 flex-1">{titleColumn && cell(titleColumn, row)}</div>

                  {actionsColumn && <div className="-my-1 shrink-0">{cell(actionsColumn, row)}</div>}
                </div>

                {fields.length > 0 && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {fields.map((column) => (
                      <div key={column.key} className="min-w-0">
                        <dt className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                          {column.header}
                        </dt>
                        <dd className={cn("mt-0.5 min-w-0 break-words", column.mono && "font-mono text-xs")}>
                          {cell(column, row)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>

        {pagination && <Pagination {...pagination} label={label} />}
      </div>
    );
  }

  /* ------------------------------------------------------------------ table */

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      {selectionBar}

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
              {selecionavel && (
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
                      column.hideBelow && HIDE_BELOW[column.hideBelow],
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
                  {...rowActivation(row)}
                  className={cn(
                    rowFocus,
                    // A selected row has a background AND a checked box —
                    // colour is not the only signal.
                    isSelected && "bg-primary/8 hover:bg-primary/12",
                  )}
                >
                  {selecionavel && (
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
                        column.hideBelow && HIDE_BELOW[column.hideBelow],
                        column.key === ACTIONS_KEY && "w-px text-right whitespace-nowrap",
                      )}
                    >
                      {cell(column, row)}
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

/**
 * Sort control for the phone cards.
 *
 * The sortable headers are gone in that layout, and the sort has to stay: a
 * list that cannot be put in order is a different screen, not a smaller one.
 * It sends the same `{ field, direction }` the headers send, so the backend
 * cannot tell which one was used.
 */
function CardSort<T>({
  columns,
  sort,
  onSortChange,
}: {
  columns: Column<T>[];
  sort?: Sort | null;
  onSortChange: (sort: Sort) => void;
}) {
  const sortable = columns.filter((column) => column.sortable);
  if (sortable.length === 0) return null;

  // A header can be markup; the option needs text.
  const nameOf = (column: Column<T>) =>
    typeof column.header === "string" ? column.header : column.key;

  const toValue = (field: string, direction: SortDirection) => `${field}:${direction}`;

  // A default order on a field with no column (creation date, say) matches
  // no option. The empty value keeps the "Ordenar" placeholder instead of an
  // empty trigger.
  const current =
    sort && sortable.some((column) => column.key === sort.field)
      ? toValue(sort.field, sort.direction)
      : "";

  return (
    <div className="border-border flex justify-end border-b px-4 py-2">
      <Select
        value={current}
        onValueChange={(value) => {
          // The last colon splits: the field name is the backend's, not ours.
          const cut = value.lastIndexOf(":");
          onSortChange({
            field: value.slice(0, cut),
            direction: value.slice(cut + 1) as SortDirection,
          });
        }}
      >
        <SelectTrigger size="sm" aria-label="Ordenar lista" className="w-auto max-w-full">
          <ArrowDownUp aria-hidden="true" />
          <SelectValue placeholder="Ordenar" />
        </SelectTrigger>

        <SelectContent>
          {sortable.flatMap((column) => [
            <SelectItem key={toValue(column.key, "asc")} value={toValue(column.key, "asc")}>
              {nameOf(column)} · crescente
            </SelectItem>,
            <SelectItem key={toValue(column.key, "desc")} value={toValue(column.key, "desc")}>
              {nameOf(column)} · decrescente
            </SelectItem>,
          ])}
        </SelectContent>
      </Select>
    </div>
  );
}
