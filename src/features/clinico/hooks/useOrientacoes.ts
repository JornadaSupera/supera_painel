import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { audit } from "@/lib/audit";
import { queryKeys } from "@/lib/queryKeys";
import { call, conteudosApi } from "@/services/apiClient";
import type { AnexoConteudo, ConteudoEntrada } from "@/types/conteudo";

/**
 * As orientações que a própria pessoa escreve.
 *
 * Tudo aqui muda um texto de saúde que, depois de aprovado, chega a pacientes em
 * tratamento — então cada escrita deixa rastro na trilha, além do que o banco já
 * grava por gatilho.
 *
 * As invalidações cobrem `contents` inteiro: a lista da pessoa e a fila do
 * administrador são recortes do mesmo dado, e enviar para revisão move uma
 * versão de uma para a outra.
 */

const RECURSO = "conteudos";

/** "Minhas orientações": todas as versões que a pessoa escreveu, com o estado que o autor precisa ver. */
export function useMinhasOrientacoes() {
  return useQuery({
    queryKey: queryKeys.contents.mine(),
    queryFn: async () => (await call(() => conteudosApi.listMine({ page: 1, pageSize: 100 }))).data,
  });
}

export function useOrientacao(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contents.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => (await call(() => conteudosApi.getById({ id: id as string }))).data,
  });
}

/** As categorias da(s) especialidade(s) da pessoa: são o único lugar onde ela pode escrever. */
export function useCategoriasDaMinhaArea() {
  return useQuery({
    queryKey: queryKeys.contents.categories(),
    queryFn: async () => (await call(() => conteudosApi.listCategories())).data,
  });
}

function useInvalidarConteudo() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contents.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all }),
    ]);
}

export function useCriarOrientacao() {
  const invalidar = useInvalidarConteudo();

  return useMutation({
    mutationFn: async (entrada: ConteudoEntrada) => (await call(() => conteudosApi.create(entrada))).data,
    onSuccess: async (orientacao) => {
      if (orientacao) audit.update(RECURSO, orientacao.id, { operacao: "criacao_rascunho" });
      await invalidar();
    },
    onError: (erro) => toast.error("Não foi possível salvar o rascunho", { description: erro.message }),
  });
}

export function useSalvarOrientacao() {
  const invalidar = useInvalidarConteudo();

  return useMutation({
    mutationFn: async (params: { id: string; dados: Partial<ConteudoEntrada> }) =>
      (await call(() => conteudosApi.update(params))).data,
    onSuccess: async (_orientacao, params) => {
      audit.update(RECURSO, params.id, { operacao: "edicao_rascunho" });
      await invalidar();
    },
    onError: (erro) => toast.error("Não foi possível salvar o rascunho", { description: erro.message }),
  });
}

export function useEnviarParaRevisao() {
  const invalidar = useInvalidarConteudo();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => conteudosApi.submitForReview({ id }))).data,
    onSuccess: async (_orientacao, id) => {
      audit.update(RECURSO, id, { operacao: "envio_para_revisao" });
      await invalidar();
      toast.success("Enviada para revisão", {
        description: "O administrador decide se publica, devolve ou rejeita.",
      });
    },
    onError: (erro) => toast.error("Não foi possível enviar para revisão", { description: erro.message }),
  });
}

export function useAnexarArquivo(versaoId: string) {
  const invalidar = useInvalidarConteudo();

  return useMutation({
    mutationFn: async (arquivo: File) =>
      (await call(() => conteudosApi.addAttachment({ versaoId, arquivo }))).data,
    onSuccess: async () => {
      audit.update(RECURSO, versaoId, { operacao: "anexo_adicionado" });
      await invalidar();
    },
    onError: (erro) => toast.error("Não foi possível anexar", { description: erro.message }),
  });
}

export function useRemoverAnexo(versaoId: string) {
  const invalidar = useInvalidarConteudo();

  return useMutation({
    mutationFn: async (anexo: AnexoConteudo) =>
      (await call(() => conteudosApi.removeAttachment({ versaoId, anexo }))).data,
    onSuccess: async () => {
      audit.update(RECURSO, versaoId, { operacao: "anexo_removido" });
      await invalidar();
    },
    onError: (erro) => toast.error("Não foi possível remover o anexo", { description: erro.message }),
  });
}

/**
 * O conteúdo de um anexo, como URL `blob:`.
 *
 * O navegador só carrega imagem de `blob:` (a política de conteúdo do painel não
 * libera o domínio do armazenamento). A URL nasce e morre no mesmo efeito, e por
 * isso não é criada durante a renderização: com o arquivo já em cache, o React
 * remonta o efeito e reaproveitaria uma URL que o primeiro cleanup revogou.
 */
export function useAnexoConteudoUrl(caminho: string, habilitado = true) {
  const consulta = useQuery({
    queryKey: queryKeys.contents.attachment(caminho),
    enabled: habilitado,
    queryFn: async () => (await call(() => conteudosApi.downloadAttachment({ caminho }))).data,
    staleTime: Infinity,
    retry: false,
  });

  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!consulta.data) {
      setUrl(null);
      return;
    }

    const criada = URL.createObjectURL(consulta.data);
    setUrl(criada);
    return () => URL.revokeObjectURL(criada);
  }, [consulta.data]);

  return { url, isLoading: consulta.isLoading, isError: consulta.isError };
}
