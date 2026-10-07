import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Quick filters as a row of pills: "Todos", "Não resolvidas", one per phase.
 *
 * One pill is pressed at a time per group, and the pressed state is announced
 * (`aria-pressed`), not only painted. They sit under the search, where the
 * filter that is used most stays one click away.
 *
 *   <FilterChipGroup label="Filtrar por fase">
 *     <FilterChip active={!phase} onClick={() => setPhase("")}>Todos</FilterChip>
 *     …
 *   </FilterChipGroup>
 */
export function FilterChipGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {children}
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
