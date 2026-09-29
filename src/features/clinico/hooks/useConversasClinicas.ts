import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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

  // A URL nasce e morre no MESMO efeito. Criá-la durante a renderização e
  // revogá-la no cleanup quebra com o dado já em cache: o React remonta o
  // efeito (sempre em desenvolvimento) e reaproveita a URL que o primeiro
  // cleanup acabou de revogar, e a imagem fica quebrada.
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

  return { url, isLoading: consulta.isLoading, isError: consulta.isError, refetch: consulta.refetch };
}

function useInvalidarConversas() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.clinico.all });
}

export function useAssumirConversa() {
  const invalidar = useInvalidarConversas();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.assumirConversa({ id }))).data,
    onSuccess: async () => {
      await invalidar();
      toast.success("Conversa assumida");
    },
    onError: (erro) => toast.error("Não foi possível assumir a conversa", { description: erro.message }),
  });
}

export function useResolverConversa() {
  const invalidar = useInvalidarConversas();

  return useMutation({
    mutationFn: async (id: string) => (await call(() => clinicoApi.resolverConversa({ id }))).data,
    onSuccess: async () => {
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
