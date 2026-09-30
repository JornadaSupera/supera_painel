import type { Option } from "@/lib/enums";
import { FilterSelect } from "./FilterBar";
import { SourceErrorChip } from "./SourceError";

/**
 * A listing filter whose options come from a catalog that can fail to load.
 *
 * When it fails, the select gives way to the reason and a retry: an empty list
 * caused by a network error looks exactly like a catalog with nothing in it, and
 * whoever sees "Protocol: all" with no option concludes the clinic has none.
 */
export function CatalogFilterSelect({
  label,
  errorLabel,
  value,
  onChange,
  options,
  isError,
  onRetry,
  allLabel,
  className,
}: {
  label: string;
  /** How the failure names the list: "A lista de protocolos". */
  errorLabel: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  isError: boolean;
  onRetry: () => void;
  allLabel?: string;
  className?: string;
}) {
  if (isError) return <SourceErrorChip label={errorLabel} onRetry={onRetry} />;

  return (
    <FilterSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      allLabel={allLabel}
      className={className}
    />
  );
}
