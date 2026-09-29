import { Search, X } from "lucide-react";
import { useRef } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Search field used by the listings.
 *
 * A controlled component. The delay between typing and querying belongs to the
 * caller — through `useDebouncedValue` — because the displayed value has to
 * follow the keystrokes while only the query waits.
 */

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Accessible name; never visible. */
  label?: string;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  label = "Buscar",
  className,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("relative flex w-full max-w-85 items-center", className)}>
      <Search
        size={16}
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute left-3"
      />

      <Input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        // Hides the native WebKit "x": we have our own, with an accessible label.
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            // The button unmounts with the value, and the focus would fall to
            // the page — back to the top of the tab order, away from the field
            // someone clearing a search is about to type in again.
            inputRef.current?.focus();
          }}
          aria-label="Limpar busca"
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-2 flex size-6 items-center justify-center rounded-sm transition-colors"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
