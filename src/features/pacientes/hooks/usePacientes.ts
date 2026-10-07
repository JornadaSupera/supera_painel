import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toListQuery } from "@/hooks/listQuery";
import { useListParams } from "@/hooks/useListParams";
import { audit } from "@/lib/audit";
import { queryKeys } from "@/lib/queryKeys";
import { REFRESH_MS } from "@/lib/refresh";
import { call, pacientesApi } from "@/services/apiClient";
import { usePacientesStore } from "@/stores/pacientes";
import type {
  CampoPii,
  PacienteClinicaEntrada,
  PacienteEntrada,
  PiiRevelada,
  ResultadoConvite,
} from "@/types/paciente";

/**
 * Acesso a Pacientes.
 *
 * A página nunca chama `apiClient` diretamente — pede a estes hooks. Isso
 * mantém num só lugar as três coisas que precisam andar juntas: a chave de
 * cache, a invalidação depois da escrita e o registro de auditoria.
 *
 * > [!] Auditoria é emitida aqui, não no componente.
 * Se cada botão registrasse o próprio evento, bastaria um caminho novo (atalho
 * de teclado, ação em lote) para a ação acontecer sem rastro.
 */

const RECURSO = "pacientes";

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

/** Listagem já ligada ao store de filtros. Ver `useListParams`. */
export function usePacientes() {
  const params = useListParams(usePacientesStore);

  const query = useQuery({
    queryKey: queryKeys.patients.list(params),
    queryFn: () => call(() => pacientesApi.list(params)),
    // Mantém a página anterior visível durante a troca de página: sem isso a
    // tabela pisca para o esqueleto a cada clique na paginação.
    placeholderData: (anterior) => anterior,
    refetchInterval: REFRESH_MS.auditada,
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, pacientes: items, params };
}

/**
 * Ficha completa.
 *
 * Abrir uma ficha é um evento de auditoria, e quem o grava é o banco:
 * `read_patient` registra a leitura no titular antes de devolver a linha. O
 * painel não emite o evento em paralelo — ver `lib/audit.ts`.
 */
export function usePaciente(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.patients.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => (await call(() => pacientesApi.getById({ id: id as string }))).data,
    refetchInterval: REFRESH_MS.auditada,
  });
}

/* -------------------------------------------------------------------------
   REVELAÇÃO DE DADO PESSOAL
   ------------------------------------------------------------------------- */

/**
 * Traz CPF, telefone ou e-mail em claro.
 *
 * Não é `useQuery`: revelar é um ATO, não uma leitura de tela. Como mutation,
 * nada dispara sozinho no remonte do componente e o valor não fica no cache
 * compartilhado — some junto com o componente que o pediu.
 */
export function useRevelarPii(pacienteId: string) {
  return useMutation<PiiRevelada, Error, CampoPii[]>({
    mutationFn: async (campos) => {
      audit.confidential(RECURSO, pacienteId, pacienteId);
      const { data } = await call(() => pacientesApi.revealPii({ id: pacienteId, campos }));
      return data ?? {};
    },
    onError: (erro) => toast.error("Não foi possível revelar o dado", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   ESCRITA
   ------------------------------------------------------------------------- */

function useInvalidarPacientes() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.patients.all });
}

/**
 * What became of the SMS, in the same words wherever an invite is issued. The
 * activation code is never shown: it only exists inside the message.
 */
function avisarConvite(resultado: ResultadoConvite | null | undefined) {
  if (resultado?.enviado) {
    toast.success("Convite enviado por SMS", {
      description: `O paciente recebe o código de ativação em ${resultado.destino ?? "seu celular"}.`,
    });
    return;
  }

  if (resultado?.falha === "sms_recusado") {
    toast.warning("O SMS não saiu", {
      description:
        "O provedor de SMS recusou o envio. Confira o celular da ficha e reemita o convite.",
    });
    return;
  }

  toast.info("O código de ativação vai por SMS", {
    description:
      "O envio por SMS ainda não está configurado no servidor, então nenhuma mensagem saiu agora. Quando estiver, reemita o convite pela ficha e o código chega no celular do paciente.",
  });
}

/**
 * Cadastro, e — quando o formulário pede — o convite logo em seguida.
 *
 * As duas chamadas ficam aqui, e não dentro do adapter, porque a tela precisa
 * saber se o SMS saiu para dizer isso a quem cadastrou.
 *
 * > [!] Falha no convite NÃO derruba o cadastro.
 * A ficha já existe neste ponto. Propagar o erro faria a tela dizer "não foi
 * possível cadastrar" sobre um paciente que está no banco, e a tentativa
 * seguinte esbarraria em "já existe ficha com este CPF". O convite falho vira
 * aviso, e o botão da ficha reemite.
 */
export function useCriarPaciente() {
  const invalidar = useInvalidarPacientes();

  return useMutation({
    mutationFn: async ({
      entrada,
      clinica,
    }: {
      entrada: PacienteEntrada;
      clinica?: PacienteClinicaEntrada | null;
    }) => {
      const { data: criado } = await call(() => pacientesApi.create(entrada));

      /*
       * O quadro clínico é uma segunda escrita, e ela não pode derrubar a
       * primeira: a ficha já existe neste ponto, e reportar "não foi possível
       * cadastrar" faria alguém tentar de novo e esbarrar em "já existe ficha
       * com este CPF". O que falha aqui vira aviso, e a ficha abre para
       * correção — o mesmo tratamento que o convite recebe logo abaixo.
       */
      let paciente = criado;
      let erroClinica: string | null = null;

      if (criado && clinica) {
        try {
          const { data } = await call(() =>
            pacientesApi.updateClinical({ id: criado.id, dados: clinica }),
          );
          paciente = data ?? criado;
          audit.update(RECURSO, criado.id, { operacao: "quadro_clinico" });
        } catch (erro) {
          erroClinica =
            erro instanceof Error ? erro.message : "Falha ao registrar o quadro clínico.";
        }
      }

      if (!paciente || !entrada.enviar_convite) {
        return { paciente, convite: null, erroConvite: null, erroClinica };
      }

      try {
        const { data: convite } = await call(() => pacientesApi.sendInvite({ id: paciente.id }));
        audit.update(RECURSO, paciente.id, { operacao: "convite" });
        return { paciente, convite, erroConvite: null, erroClinica };
      } catch (erro) {
        return {
          paciente,
          convite: null,
          erroConvite: erro instanceof Error ? erro.message : "Falha ao emitir o convite.",
          erroClinica,
        };
      }
    },
    onSuccess: async ({ paciente, convite, erroConvite, erroClinica }) => {
      if (paciente) audit.update(RECURSO, paciente.id, { operacao: "criacao" });
      await invalidar();

      toast.success("Paciente cadastrado", {
        description: paciente ? `${paciente.nome} · ${paciente.codigo}` : undefined,
      });

      if (convite) avisarConvite(convite);

      if (erroClinica) {
        toast.warning("A ficha foi criada sem o quadro clínico", {
          description: `${erroClinica} Registre pela edição da ficha.`,
        });
      }

      if (erroConvite) {
        toast.warning("A ficha foi criada, mas o convite não saiu", {
          description: `${erroConvite} Reemita pela ficha.`,
        });
      }
    },
    onError: (erro) => toast.error("Não foi possível cadastrar", { description: erro.message }),
  });
}

/**
 * Edição da ficha — cadastro e quadro clínico no mesmo salvamento.
 *
 * As duas escritas ficam aqui, e não no adapter, porque são operações com
 * permissões diferentes: um dia a segunda pode ser negada a quem pode a
 * primeira, e nesse dia a tela precisa continuar salvando o que pode.
 *
 * Ordem importa. O cadastro primeiro: se o quadro clínico falhar, a correção
 * de nome e telefone já está gravada, e repetir o salvamento é inofensivo —
 * `update_patient` sobrescreve. O inverso não seria verdade.
 */
export function useAtualizarPaciente(id: string) {
  const invalidar = useInvalidarPacientes();

  return useMutation({
    mutationFn: async ({
      dados,
      clinica,
    }: {
      dados: Partial<PacienteEntrada>;
      clinica?: PacienteClinicaEntrada | null;
    }) => {
      const { data } = await call(() => pacientesApi.update({ id, dados }));

      if (!clinica) return data;

      const { data: comQuadro } = await call(() =>
        pacientesApi.updateClinical({ id, dados: clinica }),
      );
      audit.update(RECURSO, id, { operacao: "quadro_clinico" });

      return comQuadro ?? data;
    },
    onSuccess: async (paciente) => {
      audit.update(RECURSO, id, { campos: paciente ? Object.keys(paciente).length : 0 });
      await invalidar();
      toast.success("Ficha atualizada");
    },
    onError: (erro) => toast.error("Não foi possível salvar", { description: erro.message }),
  });
}

/** Desativação lógica, sempre com motivo — é o que a auditoria exibe depois. */
export function useDesativarPaciente() {
  const invalidar = useInvalidarPacientes();

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data } = await call(() => pacientesApi.deactivate({ id, motivo }));
      audit.delete(RECURSO, id, motivo);
      return data;
    },
    onSuccess: async (paciente) => {
      await invalidar();
      toast.success("Paciente desativado", {
        description: paciente ? `${paciente.nome} não aparece mais como ativo.` : undefined,
      });
    },
    onError: (erro) => toast.error("Não foi possível desativar", { description: erro.message }),
  });
}

export function useEnviarConvite() {
  const invalidar = useInvalidarPacientes();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await call(() => pacientesApi.sendInvite({ id }));
      audit.update(RECURSO, id, { operacao: "convite_sms" });
      return data;
    },
    onSuccess: async (resultado) => {
      await invalidar();
      avisarConvite(resultado);
    },
    onError: (erro) => toast.error("Não foi possível emitir o convite", { description: erro.message }),
  });
}

/**
 * Cancela o convite pendente sem emitir outro.
 *
 * Existe ao lado de "reemitir", e não no lugar dele: reemitir já cancela o
 * anterior. Este é o caminho de quando o convite foi para o número errado e
 * **não** se quer um código novo circulando enquanto ninguém confere o contato.
 */
export function useCancelarConvite() {
  const invalidar = useInvalidarPacientes();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await call(() => pacientesApi.cancelInvite({ id }));
      audit.update(RECURSO, id, { operacao: "convite_cancelado" });
      return data;
    },
    onSuccess: async () => {
      await invalidar();
      toast.success("Convite cancelado", {
        description: "O código deixou de valer. Emita outro quando o contato estiver conferido.",
      });
    },
    onError: (erro) =>
      toast.error("Não foi possível cancelar o convite", { description: erro.message }),
  });
}

/**
 * Desfaz o vínculo entre a ficha e a conta do aplicativo.
 *
 * O aviso diz o que **fica**, porque a preocupação de quem clica é o que se
 * perde: a ficha, o histórico e a conta continuam inteiros — o que se desfaz é
 * a ligação entre a ficha e a conta.
 */
export function useDesvincularConta() {
  const invalidar = useInvalidarPacientes();

  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { data } = await call(() => pacientesApi.unlinkAccount({ id }));
      audit.update(RECURSO, id, { operacao: "vinculo_desfeito", motivo });
      return data;
    },
    onSuccess: async () => {
      await invalidar();
      toast.success("Vínculo desfeito", {
        description:
          "A ficha, o histórico e a conta continuam. O paciente perde o acesso a esta ficha pelo aplicativo até um convite novo ser aceito.",
      });
    },
    onError: (erro) =>
      toast.error("Não foi possível desfazer o vínculo", { description: erro.message }),
  });
}

/**
 * Quem acompanha o paciente.
 *
 * Leitura própria, e não parte da ficha: é dado pessoal de terceiro, e só é
 * buscado quando alguém abre a ficha de fato — carregá-lo junto da listagem
 * traria contato de acompanhante para telas que não o mostram.
 */
export function useCuidadores(id: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.patients.caregivers(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => call(() => pacientesApi.listCuidadores({ id: id as string })),
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, cuidadores: items };
}

/* -------------------------------------------------------------------------
   EXPORTAÇÃO
   ------------------------------------------------------------------------- */

/** A exportação é a mesma do painel clínico; ver `hooks/useExportarPacientes`. */
export { useExportarPacientes } from "@/hooks/useExportarPacientes";
