import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de busca das listagens.
 *
 * Componente controlado. O atraso entre digitar e consultar é
 * responsabilidade de quem usa — via `useDebouncedValue` — porque o valor
 * exibido precisa acompanhar a digitação, enquanto só a consulta espera.
 */

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Nome acessível; não fica visível. */
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
  return (
    <div className={cn("relative flex w-full max-w-85 items-center", className)}>
      <Search
        size={16}
        aria-hidden="true"
        className="text-muted-foreground pointer-events-none absolute left-3"
      />

      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        // Esconde o "x" nativo do WebKit: temos o nosso, com rótulo acessível.
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpar busca"
          className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-2 flex size-6 items-center justify-center rounded-sm transition-colors"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
