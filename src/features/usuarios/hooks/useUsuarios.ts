import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { toListQuery } from "@/hooks/listQuery";
import { useListParams } from "@/hooks/useListParams";
import { audit } from "@/lib/audit";
import { STATUS_USUARIO, STATUS_USUARIO_LABEL, type StatusUsuario } from "@/lib/enums";
import { queryKeys } from "@/lib/queryKeys";
import { call, permissoesApi, usuariosApi } from "@/services/apiClient";
import { ApiException, ERROR_CODE } from "@/services/contracts";
import { useUsuariosStore } from "@/stores/usuarios";
import type { ConviteEquipeEntrada, UsuarioEntrada } from "@/types/usuario";

/**
 * Acesso a Usuários e à matriz de permissões.
 *
 * Todo mundo aqui é ação sobre acesso de alguém — criar conta, revogar acesso,
 * resetar senha, desligar segundo fator, conceder permissão. Por isso cada
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
 * Liga ou desliga a CONTA, que é o ato por trás de dois botões diferentes:
 * desativar a conta inteira e desistir de um convite. O que muda entre eles é o
 * texto — a operação, o aviso de sucesso e o de falha —, e por isso o mecanismo
 * é um só.
 */
interface TextosDaConta {
  /** Como o ato aparece na trilha do painel. */
  operacao: (ativa: boolean) => string;
  sucesso: (ativa: boolean) => { titulo: string; descricao: string };
  falha: string;
}

function useMudarConta(textos: TextosDaConta) {
  const invalidar = useInvalidarUsuarios();

  return useMutation({
    mutationFn: async ({ id, ativa, motivo }: { id: string; ativa: boolean; motivo?: string }) => {
      const { data } = await call(() => usuariosApi.setAccountActive({ id, ativa }));

      // O motivo fica no registro do painel: `audit_log` não tem coluna de
      // justificativa, e o texto não chega ao backend. Ver a lista de
      // operações indisponíveis.
      audit.update(RECURSO, id, { operacao: textos.operacao(ativa), ativa, motivo });

      return data;
    },
    onSuccess: async (_usuario, { ativa }) => {
      await invalidar();

      const { titulo, descricao } = textos.sucesso(ativa);
      toast.success(titulo, { description: descricao });
    },
    onError: (erro) => avisarFalha(textos.falha, erro),
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
  return useMudarConta({
    operacao: () => "conta",
    sucesso: (ativa) =>
      ativa
        ? {
            titulo: "Conta reativada",
            descricao: "A pessoa volta a acessar a plataforma com os perfis que tinha.",
          }
        : {
            titulo: "Conta desativada",
            descricao:
              "A pessoa perdeu o acesso a todos os perfis e ao aplicativo, e os aparelhos registrados foram invalidados.",
          },
    falha: "Não foi possível alterar a conta",
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

/* -------------------------------------------------------------------------
   CONVITE E SEGUNDO FATOR
   -------------------------------------------------------------------------
   Três ações que o banco só aceita com a sessão em dois fatores. A tela pede o
   código ANTES (`useReforcoDaSessao`); se mesmo assim a resposta for
   `MFA_REQUIRED` — a sessão caiu de nível no meio —, o aviso diz o que fazer em
   vez de mostrar um erro genérico.
   ------------------------------------------------------------------------- */

function avisarFalha(titulo: string, erro: Error) {
  if (erro instanceof ApiException && erro.code === ERROR_CODE.MFA_REQUIRED) {
    toast.error("Confirme o segundo fator", {
      description: "A sessão perdeu a verificação do segundo fator. Repita a ação e informe o código.",
    });
    return;
  }

  toast.error(titulo, { description: erro.message });
}

/** Cadastra pessoa nova e envia o convite por e-mail. */
export function useConvidarUsuario() {
  const invalidar = useInvalidarUsuarios();

  return useMutation({
    mutationFn: async (entrada: ConviteEquipeEntrada) => {
      const { data } = await call(() => usuariosApi.convidar(entrada));
      return data;
    },
    onSuccess: async (convite, entrada) => {
      if (convite) {
        audit.update(RECURSO, convite.account_id, { operacao: "convite", papel: convite.papel });
      }
      await invalidar();

      toast.success("Convite enviado", {
        description: `${entrada.nome} recebe um e-mail para criar a senha. O acesso vale quando ela abrir o link.`,
      });
    },
    onError: async (erro) => {
      // A conta e o perfil ficaram criados e só o e-mail não saiu: a lista tem
      // a linha, com "Reenviar convite". Sem isto, a pessoa tentaria cadastrar
      // de novo e bateria em "já existe uma conta com este e-mail".
      if (erro instanceof ApiException && (erro.details as { sentinela?: string } | undefined)?.sentinela === "invite_failed") {
        await invalidar();
      }
      avisarFalha("Não foi possível enviar o convite", erro);
    },
  });
}

/** Manda de novo o convite de quem ainda não o aceitou. */
export function useReenviarConvite() {
  return useMutation({
    mutationFn: async (id: string) => {
      await call(() => usuariosApi.reenviarConvite({ id }));
      audit.update(RECURSO, id, { operacao: "reenvio_convite" });
    },
    onSuccess: () =>
      toast.success("Convite reenviado", {
        description: "A pessoa deve usar o e-mail mais recente: o link do anterior pode deixar de valer.",
      }),
    onError: (erro) => avisarFalha("Não foi possível reenviar o convite", erro),
  });
}

/**
 * Desiste do convite, ou o retoma.
 *
 * O banco não tem "cancelar convite": o perfil pendente não pode ser desligado
 * (`staff_invitation_pending`), e o caminho oficial é desativar a conta — mesmo
 * que a pessoa abra o link depois, a conta desativada não entra. Retomar é
 * reativar a conta, e o convite volta a ficar pendente.
 */
export function useCancelarConvite() {
  return useMudarConta({
    operacao: (ativa) => (ativa ? "convite_retomado" : "convite_cancelado"),
    sucesso: (ativa) =>
      ativa
        ? { titulo: "Convite retomado", descricao: "Reenvie o e-mail se a pessoa ainda não tiver o link." }
        : {
            titulo: "Convite cancelado",
            descricao: "Mesmo que a pessoa abra o link, a conta desativada não entra.",
          },
    falha: "Não foi possível alterar o convite",
  });
}

/**
 * Redefine o segundo fator de outra pessoa da equipe.
 *
 * A pessoa perde os fatores e as sessões, e entra só com a senha até cadastrar
 * outro autenticador. Com a exigência do administrador ligada no banco, quem
 * teve o fator redefinido fica sem o acesso administrativo até recadastrar.
 */
export function useRedefinirFator() {
  const invalidar = useInvalidarUsuarios();

  return useMutation({
    mutationFn: async ({ id }: { id: string; motivo?: string }) => {
      const { data } = await call(() => usuariosApi.resetMfa({ id }));
      return data;
    },
    onSuccess: async (resultado, { id, motivo }) => {
      audit.update(RECURSO, id, { operacao: "mfa_redefinido", motivo });
      await invalidar();

      toast.success("Segundo fator redefinido", {
        description: resultado
          ? `${resultado.fatores_removidos} autenticador(es) removido(s) e ${resultado.sessoes_encerradas} sessão(ões) encerrada(s). A pessoa cadastra outro ao entrar.`
          : undefined,
      });
    },
    onError: (erro) => avisarFalha("Não foi possível redefinir o segundo fator", erro),
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
