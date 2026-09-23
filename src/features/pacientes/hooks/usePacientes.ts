import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toListQuery } from "@/hooks/listQuery";
import { useListParams } from "@/hooks/useListParams";
import { audit } from "@/lib/audit";
import { downloadCsv } from "@/lib/csv";
import { queryKeys } from "@/lib/queryKeys";
import { call, pacientesApi } from "@/services/apiClient";
import type { ListParams } from "@/services/contracts";
import { usePacientesStore } from "@/stores/pacientes";
import type { CampoPii, PacienteEntrada, PiiRevelada } from "@/types/paciente";

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
 * Cadastro, e — quando o formulário pede — o convite logo em seguida.
 *
 * As duas chamadas ficam aqui, e não dentro do adapter, por causa do código de
 * ativação: ele existe uma única vez e precisa chegar à tela. Emitido lá
 * dentro, seria descartado antes de alguém o ver.
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
    mutationFn: async (entrada: PacienteEntrada) => {
      const { data: paciente } = await call(() => pacientesApi.create(entrada));
      if (!paciente || !entrada.enviar_convite) {
        return { paciente, convite: null, erroConvite: null };
      }

      try {
        const { data: convite } = await call(() => pacientesApi.sendInvite({ id: paciente.id }));
        audit.update(RECURSO, paciente.id, { operacao: "convite" });
        return { paciente, convite, erroConvite: null };
      } catch (erro) {
        return {
          paciente,
          convite: null,
          erroConvite: erro instanceof Error ? erro.message : "Falha ao emitir o convite.",
        };
      }
    },
    onSuccess: async ({ paciente, erroConvite }) => {
      if (paciente) audit.update(RECURSO, paciente.id, { operacao: "criacao" });
      await invalidar();

      toast.success("Paciente cadastrado", {
        description: paciente ? `${paciente.nome} · ${paciente.codigo}` : undefined,
      });

      if (erroConvite) {
        toast.warning("A ficha foi criada, mas o convite não saiu", {
          description: `${erroConvite} Reemita pela ficha.`,
        });
      }
    },
    onError: (erro) => toast.error("Não foi possível cadastrar", { description: erro.message }),
  });
}

export function useAtualizarPaciente(id: string) {
  const invalidar = useInvalidarPacientes();

  return useMutation({
    mutationFn: async (dados: Partial<PacienteEntrada>) => {
      const { data } = await call(() => pacientesApi.update({ id, dados }));
      return data;
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
      // O texto não promete envio: não há provedor contratado, e o que acontece
      // de fato é a emissão do código. Prometer "enviado por SMS" faria a
      // recepção esperar uma mensagem que ninguém despacha.
      toast.success("Convite emitido", {
        description: resultado?.destino ? `Registrado para ${resultado.destino}` : undefined,
      });
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

/**
 * Exporta a lista com os MESMOS filtros da tela.
 *
 * A auditoria é registrada antes da requisição: o que precisa ficar gravado é a
 * intenção de extrair a base, mesmo que o download falhe no meio.
 */
export function useExportarPacientes(params: ListParams) {
  return useMutation({
    mutationFn: async () => {
      audit.export(RECURSO, { formato: "csv", filtros: params.filters, busca: params.search });

      const { data, count } = await call(() => pacientesApi.export(params));
      if (count === 0) return 0;

      downloadCsv(data, "pacientes");
      return count;
    },
    onSuccess: (quantidade) => {
      if (quantidade === 0) {
        toast.info("Nada para exportar", { description: "Nenhum paciente corresponde ao recorte." });
        return;
      }
      toast.success(`${quantidade} paciente(s) exportado(s)`, {
        description: "CPF, telefone e e-mail saem mascarados no arquivo.",
      });
    },
    onError: (erro) => toast.error("Não foi possível exportar", { description: erro.message }),
  });
}
