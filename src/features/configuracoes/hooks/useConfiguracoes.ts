import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { audit } from "@/lib/audit";
import type { Especialidade, VocabularioCriavel, VocabularioTermo } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { REFRESH_MS } from "@/lib/refresh";
import { toListQuery } from "@/hooks/listQuery";
import { call, configuracoesApi } from "@/services/apiClient";
import type { VersaoLegal } from "@/types/configuracao";
import type { ParametroOperacional } from "@/types/estatisticas";

/**
 * Leitura e escrita das configurações da clínica.
 *
 * As escritas daqui mudam o comportamento do produto para todo mundo ao mesmo
 * tempo — um documento legal novo obriga todos os pacientes a aceitar de novo,
 * um limiar novo passa a disparar alerta para a equipe inteira, um termo do
 * vocabulário retirado some do diário ou do chat de quem usa o aplicativo. Por
 * isso cada uma registra auditoria e cada uma diz, no aviso de sucesso, **o
 * efeito** e não o verbo clicado.
 */

const RECURSO = "configuracoes";

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

export function useConfiguracoes() {
  return useQuery({
    queryKey: queryKeys.settings.get(),
    queryFn: async () => (await call(() => configuracoesApi.get())).data,
  });
}

/* -------------------------------------------------------------------------
   VOCABULÁRIO DO SISTEMA
   ------------------------------------------------------------------------- */

/** Corrige rótulo e/ou ordem de um termo. O código, esse não muda. */
export function useAtualizarTermoVocabulario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      vocabulario: VocabularioTermo;
      id: string;
      label?: string;
      ordem?: number;
    }) => {
      const { data } = await call(() => configuracoesApi.atualizarTermoVocabulario(params));
      audit.update(RECURSO, params.id, {
        operacao: "vocabulario_termo",
        vocabulario: params.vocabulario,
      });

      return data;
    },
    onSuccess: async (termo) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.get() });

      toast.success("Termo atualizado", {
        description: termo ? `Passa a aparecer como “${termo.label}”.` : undefined,
      });
    },
    onError: (erro) => toast.error("Não foi possível salvar o termo", { description: erro.message }),
  });
}

/**
 * Retira um termo, ou o traz de volta — o mesmo botão nos dois sentidos.
 *
 * Diferente de motivo de situação, aqui reativar é possível pelo painel: a
 * leitura do vocabulário não esconde o que está retirado.
 */
export function useSetTermoVocabularioAtivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { vocabulario: VocabularioTermo; id: string; ativo: boolean }) => {
      const { data } = await call(() => configuracoesApi.setTermoVocabularioAtivo(params));
      audit.update(RECURSO, params.id, {
        operacao: "vocabulario_termo",
        vocabulario: params.vocabulario,
        ativo: params.ativo,
      });

      return data;
    },
    onSuccess: async (termo, params) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.get() });

      toast.success(params.ativo ? "Termo reativado" : "Termo retirado", {
        description: params.ativo
          ? `“${termo?.label}” volta a ser oferecido em todo o aplicativo.`
          : `“${termo?.label}” deixa de ser oferecido em todo o aplicativo. Reative a qualquer momento pelo mesmo botão.`,
      });
    },
    onError: (erro) => toast.error("Não foi possível alterar o termo", { description: erro.message }),
  });
}

/**
 * Novo termo num vocabulário.
 *
 * Além das Configurações, relê o que lista cada vocabulário em outras telas —
 * os gatilhos de alerta e o catálogo de efeitos (sintomas), as categorias da
 * biblioteca e os tipos da agenda — para o termo novo aparecer sem recarregar.
 */
export function useCriarTermoVocabulario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      vocabulario: VocabularioCriavel;
      label: string;
      psicologico?: boolean;
      especialidade?: Especialidade | null;
    }) => {
      const { data } = await call(() => configuracoesApi.criarTermoVocabulario(params));
      audit.update(RECURSO, data?.id ?? params.label, {
        operacao: "vocabulario_termo_criacao",
        vocabulario: params.vocabulario,
      });

      return data;
    },
    onSuccess: async (termo) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.get() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.alertRules() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.catalogs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.contents.categories() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.clinico.appointmentTypes() }),
      ]);

      toast.success("Cadastrado", {
        description: termo ? `“${termo.label}” entrou no catálogo.` : undefined,
      });
    },
    onError: (erro) => toast.error("Não foi possível cadastrar", { description: erro.message }),
  });
}

export function useTermos() {
  return useQuery({
    queryKey: queryKeys.settings.terms(),
    queryFn: async () => (await call(() => configuracoesApi.getTermos())).data,
  });
}

export function useRegrasAlerta() {
  return useQuery({
    queryKey: queryKeys.settings.alertRules(),
    queryFn: async () => (await call(() => configuracoesApi.getRegrasAlerta())).data,
  });
}

export function useMotivos() {
  return useQuery({
    queryKey: queryKeys.settings.reasons(),
    queryFn: async () => (await call(() => configuracoesApi.getMotivos())).data,
  });
}

export function useSeguranca() {
  return useQuery({
    queryKey: queryKeys.settings.security(),
    queryFn: async () => (await call(() => configuracoesApi.getSeguranca())).data,
  });
}

/* -------------------------------------------------------------------------
   SEGUNDO FATOR OBRIGATÓRIO
   ------------------------------------------------------------------------- */

/**
 * Liga e desliga a exigência de segundo fator no acesso administrativo.
 *
 * Invalida também a garantia da sessão, e não é detalhe: quem acabou de ligar a
 * exigência precisa que o painel reavalie **a própria sessão** contra a regra
 * nova. Sem isso, a tela de quem ligou continuaria operando como se nada
 * tivesse mudado até o próximo recarregamento.
 *
 * A guarda que impede trancar a clínica do lado de fora está no backend, não
 * aqui. Este hook só traduz a recusa.
 */
export function useSetExigirMfa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ exigir }: { exigir: boolean }) => {
      const { data } = await call(() => configuracoesApi.setExigirMfa({ exigir }));
      audit.update(RECURSO, "security_settings", { operacao: "exigir_mfa", exigir });

      return data;
    },
    onSuccess: async (seguranca) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.security() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.auth.assurance() }),
      ]);

      toast.success(
        seguranca?.exige_mfa ? "Segundo fator agora é obrigatório" : "Exigência desligada",
        {
          description: seguranca?.exige_mfa
            ? "Administradores sem autenticador cadastrado perdem o acesso até cadastrarem um. Quem estiver com sessão de senha apenas verá o painel bloqueado."
            : "O acesso administrativo volta a aceitar sessão de senha apenas. A exigência continua valendo na tela de login enquanto o painel a pedir.",
        },
      );
    },
    onError: (erro) =>
      toast.error("Não foi possível alterar a exigência", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   DOCUMENTO LEGAL
   ------------------------------------------------------------------------- */

const TIPO_LABEL: Record<VersaoLegal["tipo"], string> = {
  termos_de_uso: "Termos de uso",
  politica_de_privacidade: "Política de privacidade",
};

/**
 * Publica uma versão nova do documento.
 *
 * O corpo NÃO entra na auditoria: a trilha guarda metadado, e o texto integral
 * de um documento jurídico dentro de um log transformaria a trilha num segundo
 * repositório do mesmo conteúdo, com as mesmas obrigações e nenhuma das
 * proteções. Fica o que importa para uma apuração — quem publicou, qual
 * espécie, que versão saiu.
 */
export function usePublicarTermo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { tipo: VersaoLegal["tipo"]; corpo: string }) => {
      const { data } = await call(() => configuracoesApi.publishTermos(params));

      audit.update(RECURSO, data?.id ?? params.tipo, {
        operacao: "publicacao_legal",
        especie: params.tipo,
        versao: data?.versao,
      });

      return data;
    },
    onSuccess: async (versao) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.terms() });

      toast.success(`${TIPO_LABEL[versao?.tipo ?? "termos_de_uso"]} v${versao?.versao} em vigor`, {
        description:
          "A versão anterior virou histórico. Todos os pacientes precisam aceitar a nova antes de continuar usando o aplicativo.",
      });
    },
    onError: (erro) =>
      toast.error("Não foi possível publicar", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   GATILHOS DE ALERTA
   ------------------------------------------------------------------------- */

/**
 * Define, troca ou remove o limiar de um sintoma.
 *
 * Uma mutation para os dois atos, e não duas quase iguais: a diferença é
 * `grau_minimo` ser um número ou nada — o resto (auditoria, invalidação,
 * tratamento de erro) é idêntico.
 */
export function useSalvarRegraAlerta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      sintoma_id,
      sintoma_label,
      grau_minimo,
    }: {
      sintoma_id: string;
      sintoma_label: string;
      grau_minimo: number | null;
    }) => {
      const { data } = await call(() =>
        grau_minimo === null
          ? configuracoesApi.removerRegraAlerta({ sintoma_id })
          : configuracoesApi.setRegraAlerta({ sintoma_id, grau_minimo }),
      );

      audit.update(RECURSO, sintoma_id, { operacao: "gatilho_alerta", grau: grau_minimo });

      return { regra: data, sintoma_label, grau_minimo };
    },
    onSuccess: async ({ sintoma_label, grau_minimo }) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.alertRules() });

      toast.success(
        grau_minimo === null ? `${sintoma_label} não dispara mais` : `${sintoma_label} · grau ${grau_minimo}`,
        {
          description:
            grau_minimo === null
              ? "O sintoma continua sendo registrado no diário; ele só deixa de gerar alerta para a equipe."
              : "Vale a partir de agora, para os registros novos. Os alertas já abertos seguem a regra sob a qual nasceram.",
        },
      );
    },
    onError: (erro) =>
      toast.error("Não foi possível salvar o gatilho", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   MOTIVOS DE SITUAÇÃO
   ------------------------------------------------------------------------- */

export function useCriarMotivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      situacao_codigo: string;
      codigo: string;
      label: string;
      ordem?: number;
    }) => {
      const { data } = await call(() => configuracoesApi.criarMotivo(params));
      audit.update(RECURSO, data?.id ?? params.codigo, { operacao: "motivo_situacao" });

      return data;
    },
    onSuccess: async (motivo) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.reasons() });

      toast.success("Motivo cadastrado", {
        description: `“${motivo?.label}” já pode ser escolhido em ${motivo?.situacao_label.toLowerCase()} e passa a aparecer no relatório de faltas.`,
      });
    },
    onError: (erro) =>
      toast.error("Não foi possível cadastrar o motivo", { description: erro.message }),
  });
}

/** Corrige o rótulo de um motivo. O código fica: relatórios antigos apontam para ele. */
export function useAtualizarMotivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; label?: string; ordem?: number }) => {
      const { data } = await call(() => configuracoesApi.atualizarMotivo(params));
      audit.update(RECURSO, params.id, { operacao: "motivo_situacao" });

      return data;
    },
    onSuccess: async (motivo) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.reasons() });

      toast.success("Motivo corrigido", {
        description: `Passa a aparecer como “${motivo?.label}”. Os compromissos que já o usam mostram o texto novo, porque apontam para o mesmo código.`,
      });
    },
    onError: (erro) => toast.error("Não foi possível corrigir o motivo", { description: erro.message }),
  });
}

/**
 * Aposenta um motivo.
 *
 * > [!] Pelo painel, é porta de mão única.
 * A política de leitura da tabela é `is_active`: depois de aposentar, a linha
 * fica invisível a quem faz login, e nem a lista nem um botão de reativar
 * conseguem alcançá-la. O aviso de sucesso diz isso — e a correção de rótulo
 * existe para que aposentar não seja o caminho de consertar um erro de
 * digitação.
 *
 * O `ativo: true` continua no contrato porque a RPC o aceita; o painel não o
 * usa, por não ter como listar o que reativaria.
 */
export function useSetMotivoAtivo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await call(() => configuracoesApi.setMotivoAtivo({ id, ativo }));
      audit.update(RECURSO, id, { operacao: "motivo_situacao", ativo });

      // O aviso sai daqui, e não da linha devolvida: aposentar torna a linha
      // invisível, então o backend responde sem ela — corretamente.
      return ativo;
    },
    onSuccess: async (ativo) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.reasons() });

      toast.success(ativo ? "Motivo reativado" : "Motivo aposentado", {
        description: ativo
          ? "Volta a aparecer para quem registra a situação do compromisso."
          : "Sai da lista e deixa de ser oferecido. Os compromissos que já o usam continuam explicados por ele, mas o painel não consegue trazê-lo de volta.",
      });
    },
    onError: (erro) => toast.error("Não foi possível alterar o motivo", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   INTEGRAÇÃO E CONSENTIMENTOS
   ------------------------------------------------------------------------- */

export function useVinculosExternos() {
  const query = useQuery({
    queryKey: queryKeys.settings.externalLinks(),
    queryFn: () => call(() => configuracoesApi.getVinculosExternos()),
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, vinculos: items };
}

/**
 * Confirma ou rejeita um vínculo proposto pela integração.
 *
 * O aviso diz o que a decisão **faz com o prontuário**, e não "salvo com
 * sucesso": confirmar libera o sistema de origem a escrever naquela ficha, e é
 * a única coisa que quem confere precisa ter clara antes de clicar de novo na
 * linha seguinte.
 */
export function useConfirmarVinculo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, confirmar }: { id: string; confirmar: boolean }) => {
      await call(() => configuracoesApi.confirmarVinculoExterno({ id, confirmar }));
      audit.update(RECURSO, id, { operacao: "vinculo_externo", confirmar });

      return confirmar;
    },
    onSuccess: async (confirmado) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.externalLinks() });

      toast.success(confirmado ? "Vínculo confirmado" : "Vínculo rejeitado", {
        description: confirmado
          ? "A partir de agora o sistema de origem passa a preencher esta ficha."
          : "Nada do sistema de origem entra nesta ficha. A decisão fica registrada.",
      });
    },
    onError: (erro) =>
      toast.error("Não foi possível registrar a decisão", { description: erro.message }),
  });
}

/** Quem aceitou qual versão. Somente leitura: aceitar e revogar são do titular. */
export function useConsentimentos() {
  const query = useQuery({
    queryKey: queryKeys.settings.consents(),
    queryFn: () => call(() => configuracoesApi.getConsentimentos()),
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, consentimentos: items };
}

/* -------------------------------------------------------------------------
   PEDIDOS DO TITULAR (LGPD)
   ------------------------------------------------------------------------- */

export function useSolicitacoesTitular() {
  const query = useQuery({
    queryKey: queryKeys.settings.dataSubjectRequests(),
    queryFn: () => call(() => configuracoesApi.getSolicitacoesTitular()),
    // Requests arrive from the app while the tab is open.
    refetchInterval: REFRESH_MS.livre,
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, solicitacoes: items };
}

/**
 * O que o paciente escreveu no pedido de correção.
 *
 * > [!] Pode trazer dado pessoal (o celular ou o CPF corretos), então não fica
 * guardado: `gcTime: 0` apaga o texto do cache assim que o pedido é fechado, e
 * a chave não passa por `queryKeys.settings.dataSubjectRequests()`, que a lista
 * invalida e reidrata. Só a tela de um pedido chama este hook.
 */
export function useTextoSolicitacao(id: string, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.settings.dataSubjectRequests(), "text", id] as const,
    queryFn: async () => {
      const { data } = await call(() => configuracoesApi.getTextoSolicitacaoTitular({ id }));

      // Ler o que o titular escreveu é acesso a dado pessoal. Registra o fato,
      // nunca o conteúdo.
      if (data?.texto) audit.confidential(RECURSO, id);

      return data;
    },
    enabled,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
}

/**
 * Defere ou recusa um pedido do titular.
 *
 * O aviso lembra que decidir **não é cumprir**: exclusão e revogação de
 * consentimento se executam sozinhas pela rotina agendada; correção pede o
 * passo extra de `useCompletarSolicitacao`, abaixo; acesso e portabilidade o
 * titular resolve sozinho, pelo app.
 */
export function useDecidirSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; deferir: boolean; observacao: string }) => {
      const { data } = await call(() => configuracoesApi.decidirSolicitacaoTitular(params));

      // A justificativa NÃO entra na trilha: ela pode descrever o pedido de uma
      // pessoa identificada, e a trilha guarda metadado. Ela fica no registro do
      // backend, junto da decisão, que é onde uma apuração a procura.
      audit.update(RECURSO, params.id, { operacao: "lgpd", deferir: params.deferir });

      return data;
    },
    onSuccess: async (solicitacao) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.dataSubjectRequests() });

      toast.success(solicitacao?.status === "granted" ? "Pedido deferido" : "Pedido recusado", {
        description:
          solicitacao?.status === "granted"
            ? solicitacao.tipo === "rectification"
              ? "Corrija o dado na ficha do paciente e volte aqui para marcar como cumprida."
              : solicitacao.tipo === "access" || solicitacao.tipo === "portability"
                ? "O paciente já pode baixar os dados pelo app, por 15 dias."
                : "A execução acontece sozinha, em até 5 minutos — a tela mostra se ela falhar."
            : "A recusa fica registrada, e o paciente lê o motivo no app.",
      });
    },
    onError: (erro) =>
      toast.error("Não foi possível registrar a decisão", { description: erro.message }),
  });
}

/**
 * Marca um pedido de correção como cumprido, depois de o dado já ter sido
 * corrigido na ficha do paciente. Só existe para pedido deferido do tipo correção —
 * `completavel` já vem calculado pelo adapter, e é o que a tela usa para
 * mostrar o botão.
 */
export function useCompletarSolicitacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; observacao?: string }) => {
      const { data } = await call(() => configuracoesApi.completarSolicitacaoTitular(params));

      audit.update(RECURSO, params.id, { operacao: "lgpd", cumprido: true });

      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.dataSubjectRequests() });
      toast.success("Pedido marcado como cumprido");
    },
    onError: (erro) =>
      toast.error("Não foi possível marcar o pedido como cumprido", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   IDENTIDADE, MENSAGENS E HORÁRIO — `clinic_settings`, desde 25/09/2026
   ------------------------------------------------------------------------- */

export function useClinica() {
  return useQuery({
    queryKey: queryKeys.settings.clinic(),
    queryFn: async () => (await call(() => configuracoesApi.getClinica())).data,
  });
}

/** Sobe o arquivo e devolve `{ path, url }` — não grava nada em `clinic_settings` sozinho. */
export function useUploadLogo() {
  return useMutation({
    mutationFn: async (arquivo: File) => (await call(() => configuracoesApi.uploadLogo({ arquivo }))).data,
    onError: (erro) => toast.error("Não foi possível enviar o logo", { description: erro.message }),
  });
}

export function useSalvarIdentidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { corPrimaria: string; corSecundaria: string; logoPath: string | null }) => {
      const { data } = await call(() => configuracoesApi.salvarIdentidade(params));
      audit.update(RECURSO, "clinic_settings", { operacao: "identidade_visual" });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.clinic() });
      toast.success("Identidade visual salva");
    },
    onError: (erro) => toast.error("Não foi possível salvar a identidade visual", { description: erro.message }),
  });
}

export function useSalvarMensagens() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      slidesOnboarding: { titulo: string; corpo: string }[];
      mensagemForaHorario: string | null;
    }) => {
      const { data } = await call(() => configuracoesApi.salvarMensagens(params));
      audit.update(RECURSO, "clinic_settings", { operacao: "mensagens" });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.clinic() });
      toast.success("Mensagens salvas");
    },
    onError: (erro) => toast.error("Não foi possível salvar as mensagens", { description: erro.message }),
  });
}

export function useSalvarHorario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { fuso: string; intervalos: { dia_semana: number; abre: string; fecha: string }[] }) => {
      const { data } = await call(() => configuracoesApi.salvarHorario(params));
      audit.update(RECURSO, "clinic_settings", { operacao: "horario_atendimento" });
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.clinic() });
      toast.success("Horário de atendimento salvo");
    },
    onError: (erro) => toast.error("Não foi possível salvar o horário", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   METAS OPERACIONAIS — linhas de referência do gráfico de volume
   ------------------------------------------------------------------------- */

export function useMetasOperacionais() {
  return useQuery({
    queryKey: queryKeys.settings.operationalTargets(),
    queryFn: async () => (await call(() => configuracoesApi.getMetasOperacionais())).data,
  });
}

export function useSalvarMetaOperacional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ParametroOperacional) => {
      const { data } = await call(() => configuracoesApi.salvarMetaOperacional(params));
      audit.update(RECURSO, "operational_parameters", { operacao: params.codigo });
      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.settings.operationalTargets() }),
        // O gráfico de volume lê a mesma tabela — sem isto a linha de
        // referência só apareceria depois de sair e voltar da tela.
        queryClient.invalidateQueries({ queryKey: queryKeys.statistics.operational() }),
      ]);
      toast.success("Meta salva");
    },
    onError: (erro) => toast.error("Não foi possível salvar a meta", { description: erro.message }),
  });
}
