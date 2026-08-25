import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { audit } from "@/lib/audit";
import { STATUS_USUARIO_LABEL, type StatusUsuario } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { call, permissoesApi, usuariosApi } from "@/services/apiClient";
import type { ListParams } from "@/services/contracts";
import { useUsuariosStore } from "@/stores/usuarios";
import type { MatrizPermissoes, UsuarioEntrada } from "@/types/usuario";
import type { Papel } from "@/lib/enums";
import type { Permissao } from "@/lib/rbac";

/**
 * Acesso a Usuários e à matriz de permissões.
 *
 * Todo mundo aqui é ação sobre acesso de alguém — criar conta, pausar, resetar
 * senha, desligar segundo fator, mudar o que um papel pode. Por isso cada
 * mutation registra auditoria: numa investigação, "quem deu essa permissão e
 * quando" é a primeira pergunta.
 */

const RECURSO = "usuarios";

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

export function useUsuarios() {
  const busca = useUsuariosStore((estado) => estado.busca);
  const filtros = useUsuariosStore((estado) => estado.filtros);
  const sort = useUsuariosStore((estado) => estado.sort);
  const page = useUsuariosStore((estado) => estado.page);
  const pageSize = useUsuariosStore((estado) => estado.pageSize);

  const buscaAtrasada = useDebouncedValue(busca);

  const params: ListParams = {
    page,
    pageSize,
    sort,
    search: buscaAtrasada,
    filters: filtros,
  };

  const query = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => call(() => usuariosApi.list(params)),
    placeholderData: (anterior) => anterior,
  });

  return {
    ...query,
    usuarios: query.data?.data ?? [],
    total: query.data?.count ?? 0,
    params,
  };
}

export function useUsuario(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.users.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: async () => (await call(() => usuariosApi.getById({ id: id as string }))).data,
  });
}

/** Contagem por especialidade — a faixa de sete cartões no topo da tela. */
export function useDistribuicao() {
  return useQuery({
    queryKey: [...queryKeys.users.all, "distribuicao"],
    queryFn: async () => (await call(() => usuariosApi.getDistribuicao())).data,
  });
}

/** Histórico de acessos de um profissional. Só busca quando a gaveta abre. */
export function useAcessos(id: string | undefined, aberto: boolean) {
  return useQuery({
    queryKey: queryKeys.users.accessLogs(id ?? ""),
    enabled: Boolean(id) && aberto,
    queryFn: async () => {
      const resultado = await call(() =>
        usuariosApi.listAccessLogs({ id: id as string, page: 1, pageSize: 50 }),
      );
      // Consultar o rastro de outra pessoa também deixa rastro.
      audit.read("usuarios/acessos", id);
      return resultado;
    },
  });
}

/* -------------------------------------------------------------------------
   ESCRITA
   ------------------------------------------------------------------------- */

function useInvalidarUsuarios() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
}

export function useCriarUsuario() {
  const invalidar = useInvalidarUsuarios();

  return useMutation({
    mutationFn: async (entrada: UsuarioEntrada) => {
      const { data } = await call(() => usuariosApi.create(entrada));
      return data;
    },
    onSuccess: async (usuario) => {
      if (usuario) audit.update(RECURSO, usuario.id, { operacao: "criacao", papel: usuario.papel });
      await invalidar();
      toast.success("Profissional cadastrado", {
        description: "Ele recebe por e-mail o link para definir a própria senha.",
      });
    },
    onError: (erro) => toast.error("Não foi possível cadastrar", { description: erro.message }),
  });
}

export function useAtualizarUsuario(id: string) {
  const invalidar = useInvalidarUsuarios();

  return useMutation({
    mutationFn: async (dados: Partial<UsuarioEntrada>) => {
      const { data } = await call(() => usuariosApi.update({ id, dados }));
      return data;
    },
    onSuccess: async (usuario) => {
      audit.update(RECURSO, id, { papel: usuario?.papel, especialidade: usuario?.especialidade });
      await invalidar();
      toast.success("Cadastro atualizado");
    },
    onError: (erro) => toast.error("Não foi possível salvar", { description: erro.message }),
  });
}

export function useAlterarStatus() {
  const invalidar = useInvalidarUsuarios();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusUsuario }) => {
      const { data } = await call(() => usuariosApi.setStatus({ id, status }));
      audit.update(RECURSO, id, { operacao: "status", status });
      return data;
    },
    onSuccess: async (usuario) => {
      await invalidar();
      toast.success(
        usuario ? `${usuario.nome}: ${STATUS_USUARIO_LABEL[usuario.status]}` : "Status alterado",
      );
    },
    onError: (erro) => toast.error("Não foi possível alterar o status", { description: erro.message }),
  });
}

export function useResetarSenha() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await call(() => usuariosApi.resetPassword({ id }));
      audit.update(RECURSO, id, { operacao: "reset_senha" });
      return data;
    },
    onSuccess: (resultado) =>
      toast.success("Link de redefinição enviado", {
        description: resultado ? `Enviado para ${resultado.destino}` : undefined,
      }),
    onError: (erro) => toast.error("Não foi possível enviar o link", { description: erro.message }),
  });
}

/** Ligar ou desligar o segundo fator. Desligar exige motivo — o backend cobra. */
export function useAlterarMfa() {
  const invalidar = useInvalidarUsuarios();

  return useMutation({
    mutationFn: async ({ id, ativo, motivo }: { id: string; ativo: boolean; motivo?: string }) => {
      const { data } = await call(() => usuariosApi.setMfa({ id, ativo, motivo }));
      audit.update(RECURSO, id, { operacao: "mfa", ativo, motivo });
      return data;
    },
    onSuccess: async (usuario) => {
      await invalidar();
      toast.success(usuario?.mfa_ativo ? "Segundo fator ativado" : "Segundo fator desativado");
    },
    onError: (erro) => toast.error("Não foi possível alterar o segundo fator", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   MATRIZ DE PERMISSÕES
   ------------------------------------------------------------------------- */

export function useMatrizPermissoes() {
  return useQuery({
    queryKey: queryKeys.permissions.matrix(),
    queryFn: async () => (await call(() => permissoesApi.getMatrix())).data,
  });
}

export function useSalvarMatriz() {
  const queryClient = useQueryClient();

  return useMutation<MatrizPermissoes | null, Error, Record<Papel, Permissao[]>>({
    mutationFn: async (concedidas) => {
      const { data } = await call(() => permissoesApi.updateMatrix({ concedidas }));
      audit.update("permissoes", "matriz", {
        papeis: Object.fromEntries(
          Object.entries(concedidas).map(([papel, lista]) => [papel, lista.length]),
        ),
      });
      return data;
    },
    onSuccess: async () => {
      // Invalida usuários também: as permissões efetivas de cada um mudam junto.
      await queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.users.all });

      toast.success("Permissões atualizadas", {
        description: "Cada pessoa passa a usar as novas permissões no próximo acesso.",
      });
    },
    onError: (erro) => toast.error("Não foi possível salvar", { description: erro.message }),
  });
}
