import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useBlobUrl } from "@/hooks/useBlobUrl";
import { useMarcarLidasDoAlvo } from "@/hooks/useNotificacoes";
import { queryKeys } from "@/lib/queryKeys";
import { call, clinicoApi } from "@/services/apiClient";
import { ApiException } from "@/services/contracts";

/**
 * Atualização periódica, no lugar de tempo real: o profissional não lê as
 * tabelas de conversa direto, então o Realtime por mudança de tabela não
 * entregaria nada. O TanStack Query já pausa a consulta com a aba em segundo
 * plano. Cada leitura fica na trilha de auditoria, por isso os intervalos não
 * são menores que isto.
 */
const INTERVALO_LISTA = 30_000;
const INTERVALO_CONVERSA_ABERTA = 20_000;

/** A fila de conversas — toda a equipe vê a mesma lista. Ver `clinico.listConversas`. */
export function useConversasClinicas() {
  return useQuery({
    queryKey: queryKeys.clinico.conversas(),
    queryFn: async () => (await call(() => clinicoApi.listConversas())).data,
    refetchInterval: INTERVALO_LISTA,
  });
}

/** The window the response time is averaged over, on the dashboard and in the chat. */
export const RESPONSE_TIME_DAYS = 30;

/** Average minutes to the team's first reply. A summary: it changes slowly, so it is not polled. */
export function useTempoDeResposta(dias = RESPONSE_TIME_DAYS) {
  return useQuery({
    queryKey: queryKeys.clinico.tempoDeResposta(dias),
    queryFn: async () => (await call(() => clinicoApi.getTempoDeResposta({ dias }))).data,
    staleTime: 5 * 60_000,
  });
}

export function useMensagensClinicas(conversaId: string | null) {
  return useQuery({
    queryKey: queryKeys.clinico.mensagens(conversaId ?? ""),
    enabled: Boolean(conversaId),
    queryFn: async () =>
      (await call(() => clinicoApi.listMensagens({ conversaId: conversaId as string }))).data,
    refetchInterval: INTERVALO_CONVERSA_ABERTA,
  });
}

/**
 * Responde na conversa. A mensagem não volta do banco — o profissional não lê a
 * tabela —, então a conversa é relida em vez de acrescentada à mão.
 *
 * Vale a invalidação mesmo no erro: quando a mensagem saiu e só o anexo falhou,
 * a mensagem já existe e precisa aparecer.
 */
export function useEnviarMensagem() {
  const invalidar = useInvalidarConversas();

  return useMutation({
    mutationFn: async (params: { conversaId: string; corpo: string; anexo?: File }) =>
      (await call(() => clinicoApi.enviarMensagem(params))).data,
    onSettled: () => void invalidar(),
    onError: (erro) => toast.error("Não foi possível enviar", { description: erro.message }),
  });
}

/** `true` quando o erro diz que a mensagem já saiu e só o anexo falhou. */
export function mensagemJaEnviada(erro: unknown): boolean {
  return (
    erro instanceof ApiException &&
    typeof erro.details === "object" &&
    erro.details !== null &&
    (erro.details as { mensagemEnviada?: boolean }).mensagemEnviada === true
  );
}

/**
 * O conteúdo de um anexo, como URL `blob:`.
 *
 * O navegador só carrega imagem de `blob:` (a política de conteúdo do painel não
 * libera o domínio do armazenamento), por isso o arquivo é baixado e exibido a
 * partir da memória. Nada é gravado no navegador, e a URL é revogada quando o
 * componente sai da tela.
 */
export function useAnexoUrl(caminho: string, habilitado = true) {
  const consulta = useQuery({
    queryKey: queryKeys.clinico.anexo(caminho),
    enabled: habilitado,
    queryFn: async () => (await call(() => clinicoApi.baixarAnexo({ caminho }))).data,
    staleTime: Infinity,
    retry: false,
  });

  const url = useBlobUrl(consulta.data);

  return { url, isLoading: consulta.isLoading, isError: consulta.isError, refetch: consulta.refetch };
}

function useInvalidarConversas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.clinico.all });
}

/**
 * The notifications that pointed to a conversation the person has open or just
 * acted on stop being new. Opening it is reading what announced it.
 */
export function useLerNotificacoesDaConversa() {
  const marcarLidas = useMarcarLidasDoAlvo();
  return (id: string) => marcarLidas.mutate({ tabela: "conversations", id });
}

export function useAssumirConversa() {
  const invalidar = useInvalidarConversas();
  const lerNotificacoes = useLerNotificacoesDaConversa();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.assumirConversa({ id }))).data,
    onSuccess: async (_data, id) => {
      lerNotificacoes(id);
      await invalidar();
      toast.success("Conversa assumida");
    },
    onError: (erro) => toast.error("Não foi possível assumir a conversa", { description: erro.message }),
  });
}

export function useResolverConversa() {
  const invalidar = useInvalidarConversas();
  const lerNotificacoes = useLerNotificacoesDaConversa();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.resolverConversa({ id }))).data,
    onSuccess: async (_data, id) => {
      lerNotificacoes(id);
      await invalidar();
      toast.success("Conversa marcada como resolvida");
    },
    onError: (erro) => toast.error("Não foi possível resolver a conversa", { description: erro.message }),
  });
}

/** Silenciosa de propósito: marcar como lida não deve interromper quem está lendo. */
export function useMarcarConversaLida() {
  const invalidar = useInvalidarConversas();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.marcarConversaLida({ id }))).data,
    onSuccess: () => void invalidar(),
  });
}
