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
  DistribuicaoEspecialidade,
  LogAcesso,
  UsuarioDetalhe,
  UsuarioListItem,
} from "@/types/usuario";
import { paginate } from "../_list";
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
function detalhar(item: UsuarioListItem): UsuarioDetalhe {
  const efetivas = resolverPermissoes(
    { papel: item.papel, especialidade: item.especialidade, permissoesExtras: [] },
    concedidas,
  );

  return { ...item, permissoes_extras: [], permissoes_efetivas: [...efetivas] };
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

const CAMPOS_BUSCA = ["nome", "email", "registro"];
const ORDENACAO_PADRAO = { field: "nome", direction: "asc" } as const;

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
      { ...params, sort: params.sort ?? ORDENACAO_PADRAO },
      { searchFields: CAMPOS_BUSCA },
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

    const item = data ? projetar(data as unknown as LinhaConta) : null;
    if (!item) return fail(ERROR_CODE.NOT_FOUND, "Profissional não encontrado.");

    return okOne(detalhar(item));
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
   O QUE O BACKEND AINDA NÃO OFERECE
   -------------------------------------------------------------------------
   As três operações abaixo não têm caminho no banco. Existem como recusa
   explícita, e não como stub genérico, porque a tela usa a mensagem para
   desabilitar a ação ANTES de o usuário preencher um formulário inteiro.

   - `create` / `update`: `professionals` e `admins` só têm política de SELECT.
     Não há INSERT para `authenticated` nem RPC de cadastro; promover uma conta
     existente a administrador pressupõe a conta já criada no Auth por um
     servidor — o painel não tem esse servidor.
   - `setMfa`: o GoTrue só expõe e gerencia os fatores da sessão em curso.
     Ligar ou desligar o segundo fator de outra pessoa não é operação de
     cliente.
   ------------------------------------------------------------------------- */

const EM_DESENVOLVIMENTO =
  "Ainda em desenvolvimento: o backend não expõe esta operação. Fale com o responsável pelo banco.";

export async function create(): Promise<SingleResult<UsuarioDetalhe>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, `Cadastro de profissional. ${EM_DESENVOLVIMENTO}`);
}

export async function update(): Promise<SingleResult<UsuarioDetalhe>> {
  return fail(ERROR_CODE.NOT_IMPLEMENTED, `Edição de profissional. ${EM_DESENVOLVIMENTO}`);
}

export async function setMfa(): Promise<SingleResult<UsuarioDetalhe>> {
  return fail(
    ERROR_CODE.NOT_IMPLEMENTED,
    "O segundo fator é gerenciado pela própria pessoa, no aplicativo autenticador dela.",
  );
}
