import {
  ESPECIALIDADE_LABEL,
  STATUS_USUARIO,
  type Especialidade,
  type StatusUsuario,
} from "@/lib/enums";
import { mascararEmail } from "@/lib/mask";
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
  UsuarioEntrada,
  UsuarioListItem,
} from "@/types/usuario";
import { now, paginate, simulate, uuid } from "./_helpers";

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
    permissoes_extras: row.permissoes_extras,
    permissoes_efetivas: [...efetivas],
  };
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

const CAMPOS_BUSCA = ["nome", "email", "registro"];
const ORDENACAO_PADRAO = { field: "nome", direction: "asc" } as const;

export async function list(params: ListParams = {}): Promise<ListResult<UsuarioListItem>> {
  return simulate(() => {
    const resultado = paginate(
      usuarios,
      { ...params, sort: params.sort ?? ORDENACAO_PADRAO },
      { searchFields: CAMPOS_BUSCA },
    );

    return ok(resultado.data.map(toListItem), resultado.count);
  });
}

export async function getById({ id }: { id: string }): Promise<SingleResult<UsuarioDetalhe>> {
  return simulate(() => {
    const row = usuarios.find((usuario) => usuario.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");

    return okOne(toDetalhe(row));
  });
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

export async function create(entrada: UsuarioEntrada): Promise<SingleResult<UsuarioDetalhe>> {
  return simulate(() => {
    const email = entrada.email.trim().toLowerCase();

    if (usuarios.some((usuario) => usuario.email === email)) {
      return fail(ERROR_CODE.CONFLICT, "Já existe um profissional com este e-mail.");
    }

    const agora = now();

    const row: UsuarioMock = {
      id: uuid(),
      nome: entrada.nome.trim(),
      tratamento: entrada.tratamento?.trim() || null,
      email,
      // O mock nunca guarda senha escolhida por outra pessoa: o profissional
      // define a dele pelo link de primeiro acesso.
      senha_mock: "",
      papel: entrada.papel,
      especialidade: entrada.especialidade ?? null,
      registro: entrada.registro?.trim() || null,
      avatar_url: null,
      status: STATUS_USUARIO.ATIVO,
      // Segundo fator obrigatório por padrão: desligar é a exceção, e exige
      // justificativa registrada.
      mfa_ativo: entrada.mfa_ativo ?? true,
      horario_inicio: entrada.horario_inicio ?? "08:00",
      horario_fim: entrada.horario_fim ?? "18:00",
      permissoes_extras: entrada.permissoes_extras ?? [],
      ultimo_acesso_em: null,
      criado_em: agora,
    };

    usuarios.push(row);
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
  return simulate(() => {
    const row = usuarios.find((usuario) => usuario.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");

    if (dados.email) {
      const email = dados.email.trim().toLowerCase();
      if (usuarios.some((usuario) => usuario.email === email && usuario.id !== id)) {
        return fail(ERROR_CODE.CONFLICT, "Já existe um profissional com este e-mail.");
      }
      row.email = email;
    }

    if (dados.nome !== undefined) row.nome = dados.nome.trim();
    if (dados.tratamento !== undefined) row.tratamento = dados.tratamento?.trim() || null;
    if (dados.papel !== undefined) row.papel = dados.papel;
    if (dados.especialidade !== undefined) row.especialidade = dados.especialidade;
    if (dados.registro !== undefined) row.registro = dados.registro?.trim() || null;
    if (dados.horario_inicio !== undefined) row.horario_inicio = dados.horario_inicio;
    if (dados.horario_fim !== undefined) row.horario_fim = dados.horario_fim;
    if (dados.permissoes_extras !== undefined) row.permissoes_extras = dados.permissoes_extras;

    return okOne(toDetalhe(row));
  });
}

export async function setStatus({
  id,
  status,
}: {
  id: string;
  status: StatusUsuario;
}): Promise<SingleResult<UsuarioDetalhe>> {
  return simulate(() => {
    const row = usuarios.find((usuario) => usuario.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");

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
  return simulate(() => {
    const row = usuarios.find((usuario) => usuario.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");

    // O painel dispara o link; quem escolhe a senha é a própria pessoa. Um
    // administrador que define senha de terceiro quebra o não-repúdio da
    // trilha de auditoria.
    return okOne({ enviado: true as const, destino: mascararEmail(row.email) });
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
  return simulate(() => {
    const row = usuarios.find((usuario) => usuario.id === id);
    if (!row) return fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");

    // Desligar o segundo fator de quem acessa prontuário é exceção, e exceção
    // sem justificativa não fica registrada em lugar nenhum.
    if (!ativo && !motivo?.trim()) {
      return fail(ERROR_CODE.VALIDATION, "Informe o motivo para desativar o segundo fator.");
    }

    row.mfa_ativo = ativo;
    return okOne(toDetalhe(row));
  });
}
