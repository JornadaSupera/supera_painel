import { useEffect, useState } from "react";

/**
 * Delays the propagation of a value.
 *
 * Used by the listing search: without it every keystroke becomes a request —
 * and, with Supabase, a query against Postgres.
 *
 *   const search = useDebouncedValue(text, 350);
 *   useQuery({ queryKey: queryKeys.patients.list({ search }), ... })
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebouncedValue;
