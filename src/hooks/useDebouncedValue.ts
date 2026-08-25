import { useEffect, useState } from "react";

/**
 * Atrasa a propagação de um valor.
 *
 * Usado na busca das listagens: sem isso, cada tecla vira uma requisição — e,
 * com o Supabase, uma consulta ao Postgres.
 *
 *   const busca = useDebouncedValue(texto, 350);
 *   useQuery({ queryKey: queryKeys.pacientes.list({ search: busca }), ... })
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
