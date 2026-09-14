import { SelectItem } from "@/components/ui/select";
import type { Option } from "@/lib/enums";
import { EMPTY_SENTINEL } from "./select-value";

/**
 * The item list shared by `FilterSelect` and `FormSelect`: the optional
 * "no value" item, followed by the options. Internal; not exported from the
 * index.
 */
export function OptionItems({ options, emptyLabel }: { options: Option[]; emptyLabel?: string }) {
  return (
    <>
      {emptyLabel !== undefined && <SelectItem value={EMPTY_SENTINEL}>{emptyLabel}</SelectItem>}
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </>
  );
}
