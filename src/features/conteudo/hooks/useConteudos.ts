import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toListQuery } from "@/hooks/listQuery";
import { useListParams } from "@/hooks/useListParams";
import { audit } from "@/lib/audit";
import { ACAO_REVISAO, STATUS_CONTEUDO, type AcaoRevisao } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { aprovacoesApi, call, conteudosApi } from "@/services/apiClient";
import type { ListParams } from "@/services/contracts";
import { useConteudosStore } from "@/stores/conteudos";

/**
 * Acesso à biblioteca de conteúdo e à fila de aprovação.
 *
 * Toda decisão daqui muda o que os pacientes veem no aplicativo, então cada
 * mutation registra auditoria: aprovar publica um texto de saúde para gente em
 * tratamento, e "quem aprovou isso, e quando" precisa ter resposta.
 *
 * As invalidações são deliberadamente amplas — a fila e a lista de publicados
 * são recortes do MESMO dado, e aprovar move um item de uma para a outra.
 * Invalidar só a fila deixaria a tabela de publicados desatualizada na tela.
 */

const RECURSO = "conteudos";

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

/** A fila "Aguardando revisão" — o topo da tela. */
export function useFilaRevisao() {
  const query = useQuery({
    queryKey: queryKeys.approvals.queue(),
    queryFn: () => call(() => aprovacoesApi.listQueue({ page: 1, pageSize: 50 })),
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, fila: items };
}

/** A lista "Publicados", com busca, filtros e paginação. */
export function useConteudos() {
  const recorte = useListParams(useConteudosStore);

  const params: ListParams = {
    ...recorte,
    // Sem status escolhido, a tabela mostra o que está no ar. É a pergunta que
    // ela responde no protótipo: "o que o paciente está vendo hoje".
    filters: { ...recorte.filters, status: recorte.filters?.status || STATUS_CONTEUDO.PUBLICADO },
  };

  const query = useQuery({
    queryKey: queryKeys.contents.list(params),
    queryFn: () => call(() => conteudosApi.list(params)),
    placeholderData: (anterior) => anterior,
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, conteudos: items, params };
}

export function useConteudo(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.contents.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => (await call(() => conteudosApi.getById({ id: id as string }))).data,
  });
}

/**
 * A versão em revisão ao lado da anterior. Só busca quando o painel abre —
 * carregar a comparação de todos os itens da fila de antemão seria puxar o
 * corpo inteiro de textos que ninguém vai abrir.
 */
export function useComparacao(id: string | undefined, aberto: boolean) {
  return useQuery({
    queryKey: queryKeys.approvals.diff(id ?? "", 0),
    enabled: Boolean(id) && aberto,
    queryFn: async () => (await call(() => aprovacoesApi.getDiff({ id: id as string }))).data,
  });
}

/** Toda a linhagem de versões de uma orientação. */
export function useVersoes(orientacaoId: string | undefined, aberto: boolean) {
  return useQuery({
    queryKey: queryKeys.contents.versions(orientacaoId ?? ""),
    enabled: Boolean(orientacaoId) && aberto,
    queryFn: async () =>
      (
        await call(() =>
          conteudosApi.listVersions({ id: orientacaoId as string, page: 1, pageSize: 50 }),
        )
      ).data,
  });
}

/* -------------------------------------------------------------------------
   DECISÃO
   ------------------------------------------------------------------------- */

/**
 * Conteúdo e fila de aprovação caminham juntos: uma decisão editorial muda a
 * versão e tira a linha da fila.
 *
 * Em paralelo, não em série: são duas entidades independentes, e aguardar uma
 * para começar a outra só soma a latência das duas antes de a tela atualizar.
 */
function useInvalidarConteudo() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.contents.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.all }),
    ]);
  };
}

/** O que dizer depois de cada decisão — o efeito, não o verbo clicado. */
const CONFIRMACAO: Record<AcaoRevisao, { titulo: string; descricao: string }> = {
  [ACAO_REVISAO.APROVAR]: {
    titulo: "Orientação publicada",
    descricao: "Já aparece na biblioteca dos pacientes elegíveis.",
  },
  [ACAO_REVISAO.DEVOLVER]: {
    titulo: "Devolvida para ajustes",
    descricao: "O autor recebe o comentário e pode reenviar depois de corrigir.",
  },
  [ACAO_REVISAO.REJEITAR]: {
    titulo: "Versão rejeitada",
    descricao: "A versão foi encerrada. O histórico guarda o motivo.",
  },
  [ACAO_REVISAO.DESPUBLICAR]: {
    titulo: "Orientação despublicada",
    descricao: "Saiu do ar e não aparece mais para os pacientes.",
  },
};

/**
 * Aplica uma decisão de revisão.
 *
 * Uma mutation só para as quatro ações, e não quatro hooks quase iguais: a
 * diferença entre elas é o verbo enviado e o texto do aviso — o resto (registro
 * de auditoria, invalidação, tratamento de erro) é idêntico.
 */
export function useRevisarConteudo() {
  const invalidar = useInvalidarConteudo();

  return useMutation({
    mutationFn: async ({
      id,
      acao,
      comentario,
    }: {
      id: string;
      acao: AcaoRevisao;
      comentario?: string;
    }) => {
      const executar = () => {
        switch (acao) {
          case ACAO_REVISAO.APROVAR:
            return aprovacoesApi.approve({ id });
          case ACAO_REVISAO.DEVOLVER:
            return aprovacoesApi.requestChanges({ id, comentario: comentario ?? "" });
          case ACAO_REVISAO.REJEITAR:
            return aprovacoesApi.reject({ id, comentario: comentario ?? "" });
          case ACAO_REVISAO.DESPUBLICAR:
            return conteudosApi.unpublish({ id, motivo: comentario });
        }
      };

      const { data } = await call(executar);

      // O comentário não entra na auditoria: ele pode conter o texto clínico em
      // discussão, e a trilha guarda metadado, não conteúdo.
      audit.update(RECURSO, id, { operacao: "revisao", acao });

      return { conteudo: data, acao };
    },
    onSuccess: async ({ acao }) => {
      await invalidar();
      const aviso = CONFIRMACAO[acao];
      toast.success(aviso.titulo, { description: aviso.descricao });
    },
    onError: (erro) =>
      toast.error("Não foi possível registrar a decisão", { description: erro.message }),
  });
}
