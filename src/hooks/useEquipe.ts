import { useQuery } from "@tanstack/react-query";

import type { Especialidade } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { call, usuariosApi } from "@/services/apiClient";

/**
 * Equipe da clínica, para preencher seletores fora do módulo de Usuários —
 * "médico responsável" na ficha do paciente, "revisor" no fluxo de conteúdo.
 *
 * Fica em `hooks/` porque uma feature não importa de outra: o que duas
 * precisam sobe para o compartilhado.
 */

const CINCO_MINUTOS = 5 * 60 * 1000;

export function useProfissionais(especialidade?: Especialidade) {
  const params = {
    page: 1,
    // Uma clínica não tem centenas de profissionais, e um <Select> paginado é
    // pior do que uma lista longa. Se um dia tiver, isto vira busca remota.
    pageSize: 200,
    filters: { especialidade, status: "ativo" },
    sort: { field: "nome", direction: "asc" as const },
  };

  const query = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => call(() => usuariosApi.list(params)),
    staleTime: CINCO_MINUTOS,
  });

  return { ...query, profissionais: query.data?.data ?? [] };
}
