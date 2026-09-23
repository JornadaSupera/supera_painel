import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toListQuery } from "@/hooks/listQuery";
import { useListParams } from "@/hooks/useListParams";
import { audit } from "@/lib/audit";
import { STATUS_USUARIO, STATUS_USUARIO_LABEL, type StatusUsuario } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { call, permissoesApi, usuariosApi } from "@/services/apiClient";
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
  const params = useListParams(useUsuariosStore);

  const query = useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => call(() => usuariosApi.list(params)),
    placeholderData: (anterior) => anterior,
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, usuarios: items, params };
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
    // Consultar o rastro de outra pessoa também deixa rastro — e é o banco que
    // o grava, dentro da função que entrega a trilha. Ver `lib/audit.ts`.
    queryFn: () => call(() => usuariosApi.listAccessLogs({ id: id as string, page: 1, pageSize: 50 })),
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
      // O texto não promete e-mail: a conta já existe e a senha é dela. O que
      // acabou de acontecer foi a concessão do perfil, e é isso que se diz.
      toast.success("Perfil concedido", {
        description: usuario ? `${usuario.nome} já aparece na lista de usuários.` : undefined,
      });
    },
    onError: (erro) => toast.error("Não foi possível cadastrar", { description: erro.message }),
  });
}

/**
 * Contas que ainda não têm perfil no painel.
 *
 * É o seletor do cadastro. Fica em `useQuery` e não em estado local porque a
 * lista encolhe a cada concessão — e a invalidação de `users.all` já a derruba.
 */
export function useContasSemPerfil(habilitado = true) {
  return useQuery({
    queryKey: queryKeys.users.contasSemPerfil(),
    enabled: habilitado,
    queryFn: async () => (await call(() => usuariosApi.listContasSemPerfil())).data,
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

/**
 * Revoga ou devolve o acesso ao PAINEL.
 *
 * É a revogação oficial: o perfil desliga e a conta fica. O aplicativo, os
 * outros perfis e os aparelhos registrados continuam valendo — para derrubar
 * tudo existe `useDesativarConta`, que tem nome próprio por ser ato maior.
 */
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
        {
          description:
            usuario?.status === STATUS_USUARIO.ATIVO
              ? undefined
              : "O acesso ao painel foi revogado. A conta e o aplicativo continuam valendo.",
        },
      );
    },
    onError: (erro) => toast.error("Não foi possível alterar o status", { description: erro.message }),
  });
}

/**
 * Desativa a CONTA — todos os perfis, o aplicativo e o push de uma vez.
 *
 * Separada de `useAlterarStatus` porque as duas perguntas têm respostas
 * diferentes: "esta pessoa ainda opera o painel?" não é "esta pessoa ainda usa
 * a plataforma?". Um botão só para as duas escolhe a errada metade das vezes.
 */
export function useDesativarConta() {
  const invalidar = useInvalidarUsuarios();

  return useMutation({
    mutationFn: async ({ id, ativa, motivo }: { id: string; ativa: boolean; motivo?: string }) => {
      const { data } = await call(() => usuariosApi.setAccountActive({ id, ativa }));

      // O motivo fica no registro do painel: `audit_log` não tem coluna de
      // justificativa, e o texto não chega ao backend. Ver a lista de
      // operações indisponíveis.
      audit.update(RECURSO, id, { operacao: "conta", ativa, motivo });

      return data;
    },
    onSuccess: async (usuario) => {
      await invalidar();

      toast.success(usuario?.status === STATUS_USUARIO.ATIVO ? "Conta reativada" : "Conta desativada", {
        description:
          usuario?.status === STATUS_USUARIO.ATIVO
            ? "A pessoa volta a acessar a plataforma com os perfis que tinha."
            : "A pessoa perdeu o acesso a todos os perfis e ao aplicativo, e os aparelhos registrados foram invalidados.",
      });
    },
    onError: (erro) =>
      toast.error("Não foi possível alterar a conta", { description: erro.message }),
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
      // Invalida usuários também: as permissões efetivas de cada um mudam
      // junto. Em paralelo — as duas entidades não dependem uma da outra, e
      // encadear só soma latência antes de a tela atualizar.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.permissions.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
      ]);

      toast.success("Permissões atualizadas", {
        description: "Cada pessoa passa a usar as novas permissões no próximo acesso.",
      });
    },
    onError: (erro) => toast.error("Não foi possível salvar", { description: erro.message }),
  });
}

/* -------------------------------------------------------------------------
   PERMISSÕES RESTRITAS
   ------------------------------------------------------------------------- */

/**
 * As permissões que o backend restringe, com a concessão vigente da pessoa.
 *
 * Só busca quando há id: a ficha carrega antes de a aba ser aberta, e pedir a
 * lista de quem ninguém está olhando é leitura sem pergunta.
 */
export function usePermissoesRestritas(id: string | undefined) {
  const query = useQuery({
    queryKey: queryKeys.users.restrictedPermissions(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => call(() => usuariosApi.listPermissions({ id: id as string })),
  });

  const { items, ...status } = toListQuery(query);
  return { ...status, permissoes: items };
}

/**
 * Concede ou revoga uma permissão restrita.
 *
 * Uma mutation para os dois atos: a diferença é o verbo enviado, e o resto —
 * auditoria, invalidação, tratamento de erro — é idêntico.
 *
 * O aviso descreve o EFEITO e não o clique, porque o efeito não é óbvio com um
 * catálogo de semântica invertida: conceder devolve a alguém uma ação que o
 * catálogo tirou de todos.
 */
export function useAlterarPermissaoRestrita(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ codigo, conceder }: { codigo: string; conceder: boolean }) => {
      const { data } = await call(() =>
        conceder
          ? usuariosApi.grantPermission({ id, codigo })
          : usuariosApi.revokePermission({ id, codigo }),
      );

      audit.update(RECURSO, id, { operacao: "permissao_restrita", codigo, conceder });

      return data;
    },
    onSuccess: async (permissao) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.users.restrictedPermissions(id),
      });

      toast.success(permissao?.concedida ? "Permissão concedida" : "Permissão revogada", {
        description: permissao?.concedida
          ? `Passa a poder: ${permissao.label.toLowerCase()}.`
          : "A concessão foi encerrada, e a linha fica registrada com data e autor.",
      });
    },
    onError: (erro) =>
      toast.error("Não foi possível alterar a permissão", { description: erro.message }),
  });
}
