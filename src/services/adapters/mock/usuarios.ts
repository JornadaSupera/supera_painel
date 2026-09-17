import {
  ESPECIALIDADE_LABEL,
  STATUS_USUARIO,
  type Especialidade,
  type StatusUsuario,
} from "@/lib/enums";
import { maskEmail } from "@/lib/mask";
import { resolverPermissoes } from "@/lib/rbac";
import { acessos } from "@/mocks/acessos";
import { concedidas } from "@/mocks/permissoes";
import { usuarios, type UsuarioMock } from "@/mocks/usuarios";
import {
  ERROR_CODE,
  fail,
  ok,
  okOne,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  DistribuicaoEspecialidade,
  LogAcesso,
  UsuarioDetalhe,
  ContaDisponivel,
  UsuarioEntrada,
  UsuarioListItem,
} from "@/types/usuario";
import { USER_DEFAULT_SORT, USER_SEARCH_FIELDS } from "../_people";
import { now, paginate, simulate } from "./_helpers";

/**
 * Profissionais do painel.
 *
 * `senha_mock` nunca sai daqui: a projeção abaixo é explícita justamente para
 * que um campo novo no mock não vaze para a tela por descuido — `{ ...row }`
 * seria conveniente hoje e um vazamento amanhã.
 */

/* -------------------------------------------------------------------------
   PROJEÇÕES
   ------------------------------------------------------------------------- */

function toListItem(row: UsuarioMock): UsuarioListItem {
  return {
    id: row.id,
    nome: row.nome,
    tratamento: row.tratamento,
    email: row.email,
    papel: row.papel,
    especialidade: row.especialidade,
    registro: row.registro,
    avatar_url: row.avatar_url,
    status: row.status,
    mfa_ativo: row.mfa_ativo,
    horario_inicio: row.horario_inicio,
    horario_fim: row.horario_fim,
    ultimo_acesso_em: row.ultimo_acesso_em,
    criado_em: row.criado_em,
  };
}

/**
 * As permissões efetivas são resolvidas aqui, com a matriz vigente.
 *
 * A tela recebe a lista pronta em vez de recalcular: duas implementações da
 * mesma regra é como as duas passam a discordar — e discordância em regra de
 * acesso aparece como "o botão some mas a ação funciona".
 */
function toDetalhe(row: UsuarioMock): UsuarioDetalhe {
  const efetivas = resolverPermissoes(
    {
      papel: row.papel,
      especialidade: row.especialidade,
      permissoesExtras: row.permissoes_extras,
    },
    concedidas,
  );

  return {
    ...toListItem(row),
    // A base fictícia tem uma especialidade por pessoa; o backend permite
    // várias. A lista de uma só mantém a mesma forma dos dois lados.
    especialidades: row.especialidade ? [row.especialidade] : [],
    permissoes_extras: row.permissoes_extras,
    permissoes_efetivas: [...efetivas],
  };
}

/** Simula a chamada sobre o profissional pedido, ou responde NOT_FOUND. */
function comUsuario<R>(id: string, operacao: (row: UsuarioMock) => R) {
  return simulate(() => {
    const row = usuarios.find((usuario) => usuario.id === id);
    return row ? operacao(row) : fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");
  });
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

export async function list(params: ListParams = {}): Promise<ListResult<UsuarioListItem>> {
  return simulate(() => {
    const resultado = paginate(
      usuarios,
      { ...params, sort: params.sort ?? USER_DEFAULT_SORT },
      { searchFields: USER_SEARCH_FIELDS },
    );

    return ok(resultado.data.map(toListItem), resultado.count);
  });
}

export async function getById({ id }: { id: string }): Promise<SingleResult<UsuarioDetalhe>> {
  return comUsuario(id, (row) => okOne(toDetalhe(row)));
}

/**
 * Contagem por especialidade — a faixa do topo da tela.
 *
 * Conta só quem tem especialidade: administrador e gestor operam o painel, não
 * ocupam vaga de equipe assistencial. É por isso que o cabeçalho do protótipo
 * diz "16 profissionais" com 18 contas cadastradas.
 */
export async function getDistribuicao(): Promise<ListResult<DistribuicaoEspecialidade>> {
  return simulate(() => {
    const linhas = (Object.keys(ESPECIALIDADE_LABEL) as Especialidade[]).map((especialidade) => ({
      especialidade,
      label: ESPECIALIDADE_LABEL[especialidade],
      total: usuarios.filter((usuario) => usuario.especialidade === especialidade).length,
    }));

    return ok(linhas);
  });
}

export async function listAccessLogs({
  id,
  ...params
}: { id: string } & ListParams): Promise<ListResult<LogAcesso>> {
  return simulate(() => {
    const doUsuario = acessos.filter((log) => log.usuario_id === id);

    return paginate(doUsuario, {
      ...params,
      sort: params.sort ?? { field: "criado_em", direction: "desc" },
    });
  });
}

/* -------------------------------------------------------------------------
   ESCRITA
   ------------------------------------------------------------------------- */

/**
 * Concede o perfil a uma conta que já existe.
 *
 * O mock reproduz a regra do backend: a conta é pré-requisito, e cadastrar é
 * conceder — não criar acesso. `contasSemPerfil` é a lista fictícia de quem se
 * cadastrou e ainda não recebeu perfil.
 */
export async function create(entrada: UsuarioEntrada): Promise<SingleResult<UsuarioDetalhe>> {
  return simulate(() => {
    const conta = contasSemPerfil.find((candidata) => candidata.id === entrada.account_id);

    if (!conta) {
      return fail(
        ERROR_CODE.VALIDATION,
        "Esta conta não está disponível: ou não existe, ou já tem perfil no painel.",
      );
    }

    const row: UsuarioMock = {
      id: conta.id,
      nome: conta.nome,
      // Sem coluna no backend — ver `UsuarioEntrada`.
      tratamento: null,
      email: conta.email,
      // O mock nunca guarda senha escolhida por outra pessoa: o profissional
      // define a dele pelo link de primeiro acesso.
      senha_mock: "",
      papel: entrada.papel,
      especialidade: entrada.especialidade_principal ?? entrada.especialidades[0] ?? null,
      registro: entrada.registro?.trim() || null,
      avatar_url: null,
      status: STATUS_USUARIO.ATIVO,
      // Segundo fator ligado por padrão na base fictícia. O backend não sabe
      // dizer isso de outra conta: o autenticador é da pessoa.
      mfa_ativo: true,
      horario_inicio: null,
      horario_fim: null,
      permissoes_extras: [],
      ultimo_acesso_em: null,
      criado_em: now(),
    };

    usuarios.push(row);
    // A conta deixou de estar disponível no instante em que recebeu o perfil.
    contasSemPerfil.splice(contasSemPerfil.indexOf(conta), 1);

    return okOne(toDetalhe(row));
  });
}

export async function update({
  id,
  dados,
}: {
  id: string;
  dados: Partial<UsuarioEntrada>;
}): Promise<SingleResult<UsuarioDetalhe>> {
  return comUsuario(id, (row) => {
    // Nome, e-mail e papel não entram: os dois primeiros são da conta, mantidos
    // pelo titular, e trocar de papel é ato próprio — não uma edição de
    // cadastro. Ver `update` no adapter Supabase.
    if (dados.registro !== undefined) row.registro = dados.registro?.trim() || null;

    if (dados.especialidades !== undefined) {
      row.especialidade = dados.especialidade_principal ?? dados.especialidades[0] ?? null;
    }

    return okOne(toDetalhe(row));
  });
}

/**
 * Contas fictícias que se cadastraram e ainda não receberam perfil.
 *
 * Mutável de propósito: conceder um perfil retira a conta da lista, que é o que
 * o backend faz — lá o recorte é "sem linha em `admins` nem em `professionals`".
 */
const contasSemPerfil: ContaDisponivel[] = [
  {
    id: "b7c1f1d4-0000-4000-8000-000000000101",
    nome: "Marina Kruger",
    email: "marina.kruger@cosc.com.br",
    criado_em: now(),
  },
  {
    id: "b7c1f1d4-0000-4000-8000-000000000102",
    nome: "Otávio Bertoldi",
    email: "otavio.bertoldi@cosc.com.br",
    criado_em: now(),
  },
];

export async function listContasSemPerfil(): Promise<ListResult<ContaDisponivel>> {
  return simulate(() => ok([...contasSemPerfil], contasSemPerfil.length));
}

export async function setStatus({
  id,
  status,
}: {
  id: string;
  status: StatusUsuario;
}): Promise<SingleResult<UsuarioDetalhe>> {
  return comUsuario(id, (row) => {
    // Sem administrador ativo ninguém consegue reverter nada — nem restaurar o
    // próprio acesso. A trava vale igual no Postgres, como constraint.
    const admins = usuarios.filter(
      (usuario) => usuario.papel === "admin" && usuario.status === STATUS_USUARIO.ATIVO,
    );

    if (
      row.papel === "admin" &&
      status !== STATUS_USUARIO.ATIVO &&
      admins.length <= 1 &&
      admins[0]?.id === row.id
    ) {
      return fail(
        ERROR_CODE.CONFLICT,
        "Este é o último administrador ativo. Promova outro antes de desativá-lo.",
      );
    }

    row.status = status;
    return okOne(toDetalhe(row));
  });
}

export async function resetPassword({
  id,
}: {
  id: string;
}): Promise<SingleResult<{ enviado: true; destino: string }>> {
  return comUsuario(id, (row) => {
    // O painel dispara o link; quem escolhe a senha é a própria pessoa. Um
    // administrador que define senha de terceiro quebra o não-repúdio da
    // trilha de auditoria.
    return okOne({ enviado: true as const, destino: maskEmail(row.email) });
  });
}

export async function setMfa({
  id,
  ativo,
  motivo,
}: {
  id: string;
  ativo: boolean;
  motivo?: string;
}): Promise<SingleResult<UsuarioDetalhe>> {
  return comUsuario(id, (row) => {
    // Desligar o segundo fator de quem acessa prontuário é exceção, e exceção
    // sem justificativa não fica registrada em lugar nenhum.
    if (!ativo && !motivo?.trim()) {
      return fail(ERROR_CODE.VALIDATION, "Informe o motivo para desativar o segundo fator.");
    }

    row.mfa_ativo = ativo;
    return okOne(toDetalhe(row));
  });
}
