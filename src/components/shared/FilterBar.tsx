import { FilterX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Option } from "@/lib/enums";
import { OptionItems } from "./select-options";
import { fromSelectValue, toSelectValue } from "./select-value";

/**
 * Listing filter controls: the compact select and the "Limpar" button that
 * sit next to the search field.
 */

export interface FilterSelectProps {
  /** Accessible name of the field. */
  label: string;
  /** The empty string means "all". */
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  /** First item, for "all". Defaults to "<label>: todos". */
  allLabel?: string;
  /** Width utility for the trigger, e.g. `w-44`. */
  className?: string;
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = `${label}: todos`,
  className,
}: FilterSelectProps) {
  return (
    <Select value={toSelectValue(value)} onValueChange={(next) => onChange(fromSelectValue(next))}>
      <SelectTrigger size="sm" aria-label={label} className={className}>
        <SelectValue placeholder={label} />
      </SelectTrigger>

      <SelectContent>
        <OptionItems options={options} emptyLabel={allLabel} />
      </SelectContent>
    </Select>
  );
}

/** Shows up only while some search or filter is applied. */
export function ClearFiltersButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  if (!visible) return null;

  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <FilterX />
      Limpar
    </Button>
  );
}
