import type { UseQueryResult } from "@tanstack/react-query";

import type { ListResult } from "@/services/contracts";

/**
 * O RECORTE DE UMA LISTAGEM QUE A TELA REALMENTE LÊ.
 * =============================================================================
 * Os hooks de listagem devolviam `{ ...query, itens, total }`. O espalhamento
 * parece inofensivo e não é: o resultado do TanStack Query expõe **getters
 * observados**, e a biblioteca decide a que o componente se inscreve a partir
 * das propriedades que ele toca durante a renderização. Espalhar toca todas —
 * `isFetching`, `isStale`, `dataUpdatedAt`, `failureCount`, `fetchStatus` —, e a
 * tela passa a rerenderizar por mudanças que ela não usa. A mais visível é
 * `isFetching`: ela alterna a cada refetch de foco de janela, então voltar para
 * a aba rerenderizava a listagem inteira sem nada ter mudado na tela.
 *
 * Aqui as quatro propriedades de estado são lidas explicitamente, e a inscrição
 * fica limitada a elas.
 *
 * Cada hook mantém o nome de domínio da coleção (`pacientes`, `usuarios`,
 * `registros`) em vez de um `items` genérico: quem lê a página ganha mais com o
 * nome da coisa do que com a uniformidade.
 */

export interface ListQueryStatus {
  /** Total do conjunto filtrado, não da página. */
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface ListQuery<T> extends ListQueryStatus {
  items: T[];
}

export function toListQuery<T>(query: UseQueryResult<ListResult<T>, Error>): ListQuery<T> {
  return {
    items: query.data?.data ?? [],
    total: query.data?.count ?? 0,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    // A promessa do refetch não interessa a nenhuma tela, e devolvê-la obrigava
    // todo `onRetry` a escrever `() => void x.refetch()`.
    refetch: () => void query.refetch(),
  };
}
