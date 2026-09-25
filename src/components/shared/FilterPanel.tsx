import { FilterX, SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BREAKPOINT, useMediaQuery } from "@/hooks/useMediaQuery";
import { ClearFiltersButton } from "./FilterBar";

/**
 * A listing's search and filters, laid out for the screen they are on.
 *
 * From `md` up it is the usual row: the leading control, then every filter,
 * then "Limpar". On a phone that row stacked into four or five lines, and the
 * table or chart — what the person came for — started almost two screens
 * down. There the leading control stays in view and the filters move into a
 * bottom sheet behind a "Filtros" button that shows how many are applied.
 *
 *   <FilterPanel
 *     lead={<SearchInput … />}
 *     activeCount={2}
 *     onClear={clearFilters}
 *   >
 *     <FilterSelect … />
 *     <FilterSelect … />
 *   </FilterPanel>
 *
 * Filters apply as they change, in both layouts: the sheet only groups the
 * controls, it does not hold a draft. Its button closes it and shows the
 * result, which is already there.
 */

export interface FilterPanelProps {
  /** Stays visible on a phone: the search field, or the period when there is no search. */
  lead?: ReactNode;
  /** The filters themselves. On a phone they move into the sheet. */
  children: ReactNode;
  /** Filters currently applied, not counting the search. Shown on the phone button. */
  activeCount?: number;
  /** Clears search and filters. The button only shows while something is applied. */
  onClear?: () => void;
  /** Whether anything is applied — search included. Defaults to `activeCount > 0`. */
  canClear?: boolean;
}

export function FilterPanel({
  lead,
  children,
  activeCount = 0,
  onClear,
  canClear = activeCount > 0,
}: FilterPanelProps) {
  const desktop = useMediaQuery(BREAKPOINT.md);
  const [open, setOpen] = useState(false);

  if (desktop) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {lead}
        {children}
        {onClear && <ClearFiltersButton visible={canClear} onClick={onClear} />}
      </div>
    );
  }

  return (
    <>
      {/* The lead control gives up its desktop minimum width: next to the
          button it has to fit a 360px screen. */}
      <div className="flex items-center gap-2">
        {lead && <div className="min-w-0 flex-1 [&>*]:max-w-none [&>*]:min-w-0">{lead}</div>}

        <Button
          variant="outline"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={lead ? "shrink-0" : "w-full"}
        >
          <SlidersHorizontal />
          Filtros
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground ml-0.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
              {activeCount}
              <span className="sr-only"> aplicados</span>
            </span>
          )}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Bottom sheet: anchored to the bottom edge, where the thumb is. */}
        <DialogContent className="top-auto bottom-0 left-0 max-h-[85dvh] w-full max-w-full translate-x-0 translate-y-0 gap-5 overflow-y-auto rounded-t-2xl rounded-b-none pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-full">
          <DialogHeader className="text-left">
            <DialogTitle>Filtros</DialogTitle>
            <DialogDescription>Os filtros valem assim que são escolhidos.</DialogDescription>
          </DialogHeader>

          {/* Every control full width, whatever width the desktop row gave it. */}
          <div className="flex flex-col gap-3 [&_[data-slot=select-trigger]]:h-10! [&_[data-slot=select-trigger]]:w-full">
            {children}
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            {onClear && (
              <Button
                variant="ghost"
                disabled={!canClear}
                onClick={onClear}
                className="flex-1 sm:flex-none"
              >
                <FilterX />
                Limpar
              </Button>
            )}
            <Button onClick={() => setOpen(false)} className="flex-1 sm:flex-none">
              Ver resultados
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default FilterPanel;
