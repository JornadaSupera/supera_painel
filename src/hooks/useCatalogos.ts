import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/queryKeys";
import { call, catalogosApi } from "@/services/apiClient";

/**
 * Catálogos de apoio — CID-10, protocolos, especialidades e efeitos adversos.
 *
 * Ficam em `hooks/` e não em uma feature porque mais de um domínio os consome:
 * Pacientes filtra por CID e protocolo, Conteúdo marca conteúdo por CID e
 * especialidade, Estatísticas cruza protocolo com efeito adverso.
 *
 * `staleTime` alto de propósito: são listas que mudam por migração, não por uso
 * do painel. Revalidar a cada foco de janela só gastaria requisição.
 */

const UMA_HORA = 60 * 60 * 1000;

export function useCids() {
  return useQuery({
    queryKey: queryKeys.catalogos.cids(),
    queryFn: async () => (await call(() => catalogosApi.listCids())).data,
    staleTime: UMA_HORA,
  });
}

export function useProtocolos() {
  return useQuery({
    queryKey: queryKeys.catalogos.protocolos(),
    queryFn: async () => (await call(() => catalogosApi.listProtocolos())).data,
    staleTime: UMA_HORA,
  });
}

export function useEspecialidades() {
  return useQuery({
    queryKey: queryKeys.catalogos.especialidades(),
    queryFn: async () => (await call(() => catalogosApi.listEspecialidades())).data,
    staleTime: UMA_HORA,
  });
}

export function useEfeitosAdversos() {
  return useQuery({
    queryKey: queryKeys.catalogos.efeitos(),
    queryFn: async () => (await call(() => catalogosApi.listEfeitos())).data,
    staleTime: UMA_HORA,
  });
}
