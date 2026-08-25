import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { auditar } from "@/lib/audit";
import { baixarCsv } from "@/lib/csv";
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

/**
 * Listagem já ligada ao store de filtros.
 *
 * A busca é atrasada em 350 ms; os filtros não — clicar num <Select> é uma
 * decisão, e esperar depois dela parece travamento.
 */
export function usePacientes() {
  const busca = usePacientesStore((estado) => estado.busca);
  const filtros = usePacientesStore((estado) => estado.filtros);
  const sort = usePacientesStore((estado) => estado.sort);
  const page = usePacientesStore((estado) => estado.page);
  const pageSize = usePacientesStore((estado) => estado.pageSize);

  const buscaAtrasada = useDebouncedValue(busca);

  const params: ListParams = {
    page,
    pageSize,
    sort,
    search: buscaAtrasada,
    filters: filtros,
  };

  const query = useQuery({
    queryKey: queryKeys.pacientes.list(params),
    queryFn: () => call(() => pacientesApi.list(params)),
    // Mantém a página anterior visível durante a troca de página: sem isso a
    // tabela pisca para o esqueleto a cada clique na paginação.
    placeholderData: (anterior) => anterior,
  });

  return {
    ...query,
    pacientes: query.data?.data ?? [],
    total: query.data?.count ?? 0,
    params,
  };
}

/** Ficha completa. O acesso a uma ficha individual é um evento de auditoria. */
export function usePaciente(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.pacientes.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data } = await call(() => pacientesApi.getById({ id: id as string }));
      if (data) auditar.leitura(RECURSO, data.id, data.id);
      return data;
    },
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
      auditar.sigiloso(RECURSO, pacienteId, pacienteId);
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
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.pacientes.all });
}

export function useCriarPaciente() {
  const invalidar = useInvalidarPacientes();

  return useMutation({
    mutationFn: async (entrada: PacienteEntrada) => {
      const { data } = await call(() => pacientesApi.create(entrada));
      return data;
    },
    onSuccess: async (paciente) => {
      if (paciente) auditar.edicao(RECURSO, paciente.id, { operacao: "criacao" });
      await invalidar();
      toast.success("Paciente cadastrado", {
        description: paciente ? `${paciente.nome} · ${paciente.codigo}` : undefined,
      });
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
      auditar.edicao(RECURSO, id, { campos: paciente ? Object.keys(paciente).length : 0 });
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
      auditar.exclusao(RECURSO, id, motivo);
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
      auditar.edicao(RECURSO, id, { operacao: "convite_sms" });
      return data;
    },
    onSuccess: async (resultado) => {
      await invalidar();
      toast.success("Convite enviado por SMS", {
        description: resultado ? `Enviado para ${resultado.destino}` : undefined,
      });
    },
    onError: (erro) => toast.error("Não foi possível enviar o convite", { description: erro.message }),
  });
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
      auditar.exportacao(RECURSO, { formato: "csv", filtros: params.filters, busca: params.search });

      const { data, count } = await call(() => pacientesApi.export(params));
      if (count === 0) return 0;

      baixarCsv(data, "pacientes");
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
