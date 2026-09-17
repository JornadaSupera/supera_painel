import {
  ESPECIALIDADE_LABEL,
  ORIGEM_AUDITORIA,
  PAPEL,
  STATUS_USUARIO,
  type Especialidade,
  type Papel,
  type StatusUsuario,
} from "@/lib/enums";
import { maskEmail } from "@/lib/mask";
import { resolverPermissoes } from "@/lib/rbac";
import { concedidas } from "@/mocks/permissoes";
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
  ContaDisponivel,
  DistribuicaoEspecialidade,
  LogAcesso,
  UsuarioDetalhe,
  UsuarioEntrada,
  UsuarioListItem,
} from "@/types/usuario";
import { paginate } from "../_list";
import { USER_DEFAULT_SORT, USER_SEARCH_FIELDS } from "../_people";
import { executar, falhaDe, paraIso, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraAcaoAuditoria, paraEspecialidade } from "./mapping";

/**
 * Usuários do painel — quem opera, não quem é atendido.
 *
 * No banco isso não é uma tabela: é `accounts` (quem autentica) cruzada com os
 * perfis `admins` e `professionals`. Uma conta sem nenhum dos dois não é
 * usuário do painel — é uma conta criada e ainda não concedida — e por isso não
 * aparece na lista.
 *
 * > [!] O `id` desta listagem é o `account_id`, não o id do perfil.
 * É ele que `set_account_active()` recebe e é ele que `auth.uid()` devolve.
 * Usar o id do perfil faria toda ação de escrita apontar para a linha errada.
 *
 * > [!] Filtro, busca e ordenação acontecem em memória.
 * `papel` e `status` não são colunas: o primeiro vem de qual perfil existe, o
 * segundo do `is_active` da conta E do perfil. Filtrar no servidor por um campo
 * que só existe depois da projeção devolveria `count` errado — e "1–20 de 81"
 * com número errado é pior do que uma consulta a mais numa base do tamanho de
 * uma clínica.
 */

/* -------------------------------------------------------------------------
   PROJEÇÃO
   ------------------------------------------------------------------------- */

const SELECT_USUARIO = `
  id,
  full_name,
  email,
  is_active,
  created_at,
  admins ( id, is_active ),
  professionals (
    id,
    is_active,
    council_registration,
    professional_specialties ( is_primary, ended_at, specialties ( code ) )
  )
`;

interface VinculoEspecialidade {
  is_primary: boolean;
  ended_at: string | null;
  specialties: { code: string } | { code: string }[] | null;
}

interface LinhaConta {
  id: string;
  full_name: string | null;
  email: string;
  is_active: boolean;
  created_at: string;
  // Objeto, não array: `account_id` é único nas duas tabelas. Ver `umDe`.
  admins: { id: string; is_active: boolean } | null;
  professionals: {
    id: string;
    is_active: boolean;
    council_registration: string | null;
    professional_specialties: VinculoEspecialidade[] | null;
  } | null;
}

/** A especialidade principal; na falta de uma marcada, o primeiro vínculo vivo. */
function especialidadeVigente(vinculos: VinculoEspecialidade[]): Especialidade | null {
  const vivos = vinculos.filter((vinculo) => !vinculo.ended_at);
  const escolhido = vivos.find((vinculo) => vinculo.is_primary) ?? vivos[0];

  return paraEspecialidade(umDe(escolhido?.specialties)?.code);
}

/**
 * Todas as áreas vigentes.
 *
 * `ended_at` nulo é o que define "vale hoje": tirar alguém de uma área encerra
 * a vigência e mantém a linha, então filtrar pela data é obrigatório — sem
 * isso, a tela de edição traria de volta uma área que já foi revogada.
 */
function especialidadesVigentes(vinculos: VinculoEspecialidade[]): Especialidade[] {
  return vinculos
    .filter((vinculo) => !vinculo.ended_at)
    .map((vinculo) => paraEspecialidade(umDe(vinculo.specialties)?.code))
    .filter((especialidade): especialidade is Especialidade => especialidade !== null);
}

function projetar(linha: LinhaConta): UsuarioListItem | null {
  const admin = umDe(linha.admins);
  const profissional = umDe(linha.professionals);

  // Conta sem perfil concedido não é usuário do painel.
  if (!admin && !profissional) return null;

  const papel: Papel = admin ? PAPEL.ADMIN : PAPEL.PROFISSIONAL;

  // A regra dos dois `is_active`: a conta precisa estar ativa E o perfil
  // também. Desligar a conta revoga tudo de uma vez, em todos os perfis.
  const perfilAtivo = admin ? admin.is_active : (profissional?.is_active ?? false);
  const status: StatusUsuario =
    linha.is_active && perfilAtivo ? STATUS_USUARIO.ATIVO : STATUS_USUARIO.INATIVO;

  return {
    id: linha.id,
    nome: linha.full_name?.trim() || linha.email,
    // Sem coluna correspondente no banco.
    tratamento: null,
    email: linha.email,
    papel,
    especialidade: profissional
      ? especialidadeVigente(profissional.professional_specialties ?? [])
      : null,
    registro: profissional?.council_registration ?? null,
    avatar_url: null,
    status,
    // O segundo fator de OUTRA pessoa não é legível pelo cliente: o GoTrue só
    // expõe os fatores da sessão em curso. `null` significa "não sabemos", e é
    // diferente de `false` — que faria a tela acusar ausência de MFA em quem o
    // tem configurado.
    mfa_ativo: null,
    horario_inicio: null,
    horario_fim: null,
    ultimo_acesso_em: null,
    criado_em: linha.created_at,
  };
}

/**
 * As permissões efetivas continuam sendo resolvidas com a matriz do painel.
 *
 * O catálogo `permissions` do banco está vazio e nada concede permissão
 * individual ainda — hoje todo profissional ativo tem o mesmo alcance. Até que
 * a matriz vire dado, a fonte é a mesma que o `<Can>` usa, para que a tela e a
 * checagem não discordem.
 */
function detalhar(item: UsuarioListItem, linha: LinhaConta): UsuarioDetalhe {
  const efetivas = resolverPermissoes(
    { papel: item.papel, especialidade: item.especialidade, permissoesExtras: [] },
    concedidas,
  );

  const profissional = umDe(linha.professionals);

  return {
    ...item,
    especialidades: especialidadesVigentes(profissional?.professional_specialties ?? []),
    permissoes_extras: [],
    permissoes_efetivas: [...efetivas],
  };
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

export async function list(params: ListParams = {}): Promise<ListResult<UsuarioListItem>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("accounts")
      .select(SELECT_USUARIO)
      .order("created_at", { ascending: true });

    if (error) return falhaDe(error);

    const usuarios = (data as unknown as LinhaConta[])
      .map(projetar)
      .filter((item): item is UsuarioListItem => item !== null);

    return paginate(
      usuarios,
      { ...params, sort: params.sort ?? USER_DEFAULT_SORT },
      { searchFields: USER_SEARCH_FIELDS },
    );
  });
}

export async function getById({ id }: { id: string }): Promise<SingleResult<UsuarioDetalhe>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("accounts")
      .select(SELECT_USUARIO)
      .eq("id", id)
      .maybeSingle();

    if (error) return falhaDe(error);

    const linha = data as unknown as LinhaConta | null;
    const item = linha ? projetar(linha) : null;
    if (!item || !linha) return fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");

    return okOne(detalhar(item, linha));
  });
}

/**
 * Contagem por especialidade — a faixa do topo da tela.
 *
 * Conta vínculo vivo de profissional ativo. Administrador não ocupa vaga de
 * equipe assistencial, e por isso não entra em nenhum quadrado.
 */
export async function getDistribuicao(): Promise<ListResult<DistribuicaoEspecialidade>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("professional_specialties")
      .select("ended_at, specialties ( code ), professionals ( is_active )")
      .is("ended_at", null);

    if (error) return falhaDe(error);

    const linhas = data as unknown as {
      specialties: { code: string } | { code: string }[] | null;
      professionals: { is_active: boolean } | { is_active: boolean }[] | null;
    }[];

    const total = new Map<Especialidade, number>();

    for (const linha of linhas) {
      if (!umDe(linha.professionals)?.is_active) continue;

      const especialidade = paraEspecialidade(umDe(linha.specialties)?.code);
      if (!especialidade) continue;

      total.set(especialidade, (total.get(especialidade) ?? 0) + 1);
    }

    // Todas as sete aparecem, inclusive com zero: um quadrado vazio informa que
    // a clínica não tem ninguém naquela área, o que some se a linha for omitida.
    return ok(
      (Object.keys(ESPECIALIDADE_LABEL) as Especialidade[]).map((especialidade) => ({
        especialidade,
        label: ESPECIALIDADE_LABEL[especialidade],
        total: total.get(especialidade) ?? 0,
      })),
    );
  });
}

/**
 * Histórico de acessos, lido de `audit_log`.
 *
 * A trilha registra o que foi lido, por quem e quando. Não registra IP nem
 * user-agent: são dados do cliente, e o log é escrito dentro do banco, que não
 * os enxerga. Os campos vêm vazios em vez de preenchidos com suposição.
 */
export async function listAccessLogs({
  id,
  ...params
}: { id: string } & ListParams): Promise<ListResult<LogAcesso>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("audit_log")
      .select("id, occurred_at, actor_account_id, action, resource_table")
      .eq("actor_account_id", id)
      .order("occurred_at", { ascending: false })
      .limit(500);

    if (error) return falhaDe(error);

    const linhas = (
      data as unknown as {
        id: number;
        occurred_at: string;
        actor_account_id: string;
        action: string;
        resource_table: string;
      }[]
    ).map<LogAcesso>((linha) => ({
      id: String(linha.id),
      usuario_id: linha.actor_account_id,
      acao: paraAcaoAuditoria(linha.action),
      recurso: linha.resource_table,
      origem: ORIGEM_AUDITORIA.PAINEL,
      ip: "",
      user_agent: "",
      criado_em: paraIso(linha.occurred_at) ?? linha.occurred_at,
    }));

    return paginate(linhas, {
      ...params,
      sort: params.sort ?? { field: "criado_em", direction: "desc" },
    });
  });
}

/* -------------------------------------------------------------------------
   ESCRITA
   ------------------------------------------------------------------------- */

/**
 * Ativa ou desativa o acesso, via `set_account_active`.
 *
 * É a revogação de verdade: vale para todos os perfis da pessoa ao mesmo tempo
 * e desliga os aparelhos de push junto. O banco impõe duas travas que a tela
 * precisa saber traduzir — ninguém se auto-remove (`42501`) e o último
 * administrador ativo não cai (`23514`) — e ambas trazem um `HINT` escrito para
 * ser lido por quem opera o painel, que é o que `falhaDe` aproveita.
 */
export async function setStatus({
  id,
  status,
}: {
  id: string;
  status: StatusUsuario;
}): Promise<SingleResult<UsuarioDetalhe>> {
  return executar(async () => {
    if (status === STATUS_USUARIO.PAUSADO) {
      return fail(
        ERROR_CODE.NOT_IMPLEMENTED,
        "Pausar acesso ainda está em desenvolvimento: o backend só distingue ativo e inativo.",
      );
    }

    const { error } = await getSupabaseClient().rpc("set_account_active", {
      p_account_id: id,
      p_is_active: status === STATUS_USUARIO.ATIVO,
    });

    if (error) return falhaDe(error);

    return getById({ id });
  });
}

/**
 * Dispara o e-mail de redefinição. Quem escolhe a senha é a própria pessoa —
 * um administrador que define senha de terceiro quebra o não-repúdio da trilha.
 */
export async function resetPassword({
  id,
}: {
  id: string;
}): Promise<SingleResult<{ enviado: true; destino: string }>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from("accounts")
      .select("email")
      .eq("id", id)
      .maybeSingle();

    if (error) return falhaDe(error);
    if (!data) return fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");

    const email = (data as { email: string }).email;
    const { error: erroEnvio } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/nova-senha`,
    });

    if (erroEnvio) return falhaDe(erroEnvio);

    return okOne({ enviado: true as const, destino: maskEmail(email) });
  });
}

/* -------------------------------------------------------------------------
   CADASTRO DE PERFIL
   -------------------------------------------------------------------------
   Cadastrar aqui é CONCEDER um perfil sobre conta que já existe, e não criar um
   acesso. A distinção não é formal:

   - o painel roda no navegador, com a chave pública. Criar conta de terceiro
     exige a chave de serviço, que jamais entra num bundle;
   - e quem define a senha tem que ser o titular. Administrador que escolhe
     senha alheia quebra o não repúdio da trilha — a partir dali, "foi você que
     fez" deixa de ser uma afirmação sustentável.

   Daí `listContasSemPerfil`: a pessoa se cadastra, aparece no seletor, e a
   administração concede.

   > [!] Ninguém concede a si mesmo.
   O banco recusa o ato reflexivo em qualquer operação de perfil profissional, e
   o motivo é a psicologia: a especialidade decide sigilo para a plataforma
   inteira, e um administrador que se autoconcedesse `psicologia` leria o que a
   clínica decidiu que a administração não lê. A guarda não proíbe acumular os
   dois papéis — exige que OUTRA pessoa faça a concessão, e as duas ficam na
   trilha com nomes diferentes.
   ------------------------------------------------------------------------- */

/**
 * Contas ainda sem perfil no painel.
 *
 * `accounts` tem política de leitura para administrador, e `professionals` e
 * `admins` são legíveis por qualquer sessão autenticada — então o recorte sai
 * de uma consulta só, sem RPC.
 */
export async function listContasSemPerfil(): Promise<ListResult<ContaDisponivel>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("accounts")
      .select("id, full_name, email, created_at, is_active, admins ( id ), professionals ( id )")
      .order("created_at", { ascending: false });

    if (error) return falhaDe(error);

    const linhas = data as unknown as {
      id: string;
      full_name: string | null;
      email: string;
      created_at: string;
      is_active: boolean;
      admins: { id: string } | { id: string }[] | null;
      professionals: { id: string } | { id: string }[] | null;
    }[];

    const disponiveis = linhas
      // Conta desativada fica de fora: conceder perfil a quem não entra produz
      // um cadastro que parece pronto e não funciona.
      .filter((linha) => linha.is_active && !umDe(linha.admins) && !umDe(linha.professionals))
      .map<ContaDisponivel>((linha) => ({
        id: linha.id,
        nome: linha.full_name?.trim() || linha.email,
        email: linha.email,
        criado_em: linha.created_at,
      }));

    return ok(disponiveis, disponiveis.length);
  });
}

/** O id do PERFIL profissional de uma conta — é ele que as RPCs recebem. */
async function idDoProfissional(
  accountId: string,
): Promise<string | null | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient()
    .from("professionals")
    .select("id")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) return falhaDe(error);

  return (data as { id: string } | null)?.id ?? null;
}

/** Códigos de especialidade do painel → ids do catálogo do banco. */
async function idsDasEspecialidades(
  especialidades: Especialidade[],
): Promise<Map<Especialidade, string> | ReturnType<typeof falhaDe>> {
  const { data, error } = await getSupabaseClient().from("specialties").select("id, code, is_active");

  if (error) return falhaDe(error);

  const porCodigo = new Map<Especialidade, string>();

  for (const linha of (data ?? []) as { id: string; code: string; is_active: boolean }[]) {
    const especialidade = paraEspecialidade(linha.code);
    if (especialidade && linha.is_active) porCodigo.set(especialidade, linha.id);
  }

  // Especialidade pedida que o catálogo não tem é erro de cadastro, não lista
  // vazia: mandar um array menor concederia áreas a menos em silêncio.
  const faltando = especialidades.filter((especialidade) => !porCodigo.has(especialidade));
  if (faltando.length > 0) {
    return fail(
      ERROR_CODE.VALIDATION,
      `Especialidade sem correspondência ativa no cadastro: ${faltando.join(", ")}.`,
    ) as ReturnType<typeof falhaDe>;
  }

  return porCodigo;
}

/**
 * `gestor` não existe como perfil no banco.
 *
 * Há `admins` e `professionals`, e nada entre os dois. O papel continua na
 * matriz de permissões do painel porque descreve um alcance real, mas não há
 * onde gravá-lo — conceder aqui produziria uma pessoa que a lista não mostra.
 */
const SEM_PERFIL_NO_BANCO =
  "O papel de gestor não existe como perfil no cadastro: há administrador e profissional, e nada entre os dois. Escolha um dos dois ou fale com o responsável pelo banco.";

export async function create(entrada: UsuarioEntrada): Promise<SingleResult<UsuarioDetalhe>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    if (entrada.papel === PAPEL.GESTOR) {
      return fail(ERROR_CODE.NOT_IMPLEMENTED, SEM_PERFIL_NO_BANCO);
    }

    if (entrada.papel === PAPEL.ADMIN) {
      const { error } = await supabase.rpc("create_admin", { p_account_id: entrada.account_id });
      if (error) return falhaDe(error);

      return getById({ id: entrada.account_id });
    }

    const ids = await idsDasEspecialidades(entrada.especialidades);
    if (!(ids instanceof Map)) return ids;

    const principal = entrada.especialidade_principal ?? entrada.especialidades[0] ?? null;

    const { error } = await supabase.rpc("create_professional", {
      p_account_id: entrada.account_id,
      p_council_registration: entrada.registro ?? "",
      p_specialty_ids: entrada.especialidades.map((especialidade) => ids.get(especialidade)),
      p_primary_specialty_id: principal ? (ids.get(principal) ?? null) : null,
    });

    if (error) return falhaDe(error);

    return getById({ id: entrada.account_id });
  });
}

/**
 * Correção do perfil.
 *
 * Nome e e-mail NÃO entram: são colunas de `accounts`, e a única política de
 * escrita ali é a do próprio titular. Não é lacuna — é a mesma razão da senha:
 * a identidade de uma pessoa é mantida por ela.
 *
 * Trocar de papel também não: promover a administrador e revogar um perfil são
 * atos distintos, cada um com a sua trava, e um `<Select>` que faz os dois
 * esconde qual deles aconteceu.
 */
export async function update({
  id,
  dados,
}: {
  id: string;
  dados: Partial<UsuarioEntrada>;
}): Promise<SingleResult<UsuarioDetalhe>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const profissional = await idDoProfissional(id);
    if (typeof profissional !== "string") {
      if (profissional !== null) return profissional;

      return fail(
        ERROR_CODE.VALIDATION,
        "Esta conta não tem perfil de profissional. Registro de conselho e áreas só existem para quem o tem.",
      );
    }

    if (dados.registro !== undefined) {
      const { error } = await supabase.rpc("update_professional", {
        p_professional_id: profissional,
        p_council_registration: dados.registro ?? "",
      });

      if (error) return falhaDe(error);
    }

    if (dados.especialidades?.length) {
      const ids = await idsDasEspecialidades(dados.especialidades);
      if (!(ids instanceof Map)) return ids;

      const principal = dados.especialidade_principal ?? dados.especialidades[0] ?? null;

      const { error } = await supabase.rpc("set_professional_specialties", {
        p_professional_id: profissional,
        p_specialty_ids: dados.especialidades.map((especialidade) => ids.get(especialidade)),
        p_primary_specialty_id: principal ? (ids.get(principal) ?? null) : null,
      });

      if (error) return falhaDe(error);
    }

    return getById({ id });
  });
}

export async function setMfa(): Promise<SingleResult<UsuarioDetalhe>> {
  return fail(
    ERROR_CODE.NOT_IMPLEMENTED,
    "O segundo fator é gerenciado pela própria pessoa, no aplicativo autenticador dela.",
  );
}
