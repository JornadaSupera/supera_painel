import {
  ACAO_REVISAO,
  STATUS_CONTEUDO,
  TIPO_CONTEUDO,
  type AcaoRevisao,
  type StatusConteudo,
  type TipoConteudo,
} from "@/lib/enums";
import {
  ERROR_CODE,
  fail,
  okOne,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  ComparacaoVersoes,
  ConteudoDetalhe,
  ConteudoListItem,
  RevisaoConteudo,
} from "@/types/conteudo";
import { paginate } from "../_list";
import { executar, falhaDe, umDe } from "./_helpers";
import { getSupabaseClient } from "./client";
import { paraEspecialidade } from "./mapping";

/**
 * Conteúdo — a biblioteca de orientações e o workflow que a alimenta.
 *
 * A unidade desta tela é a VERSÃO, não a orientação. O banco separa a
 * orientação (`content_items`) da sua versão (`content_versions`), e é a versão
 * que percorre o fluxo. Esta listagem devolve versões: é o que a fila de
 * aprovação precisa, e é o que `review_content_version` recebe.
 *
 * > [!] Toda escrita do fluxo é a RPC `review_content_version`.
 * Ela é `security definer`, exige administrador ativo, arquiva sozinha a versão
 * que estava no ar ao aprovar e grava a decisão em `content_version_reviews`.
 * Fazer o mesmo com `.update()` esbarraria na RLS — a política de UPDATE é do
 * AUTOR, não do revisor — e deixaria o histórico sem a linha que explica a
 * decisão.
 *
 * > [!] Criar e editar orientação não é operação de administrador.
 * As políticas de INSERT exigem que o autor seja o próprio profissional
 * autenticado: quem escreve é o profissional da área, no espaço dele. O painel
 * administrativo revisa. Ver `INDISPONIVEIS` em `./index.ts`.
 */

/* -------------------------------------------------------------------------
   VOCABULÁRIO DO BANCO × VOCABULÁRIO DO PAINEL
   ------------------------------------------------------------------------- */

/**
 * `content_status` → status do painel.
 *
 * `archived` vira "despublicado" porque é o que o arquivamento significa para
 * quem opera: a versão saiu do ar. O banco arquiva em dois momentos — quando o
 * administrador despublica e quando uma nova versão é aprovada por cima — e a
 * tela não precisa distinguir os dois para decidir o que mostrar.
 */
const STATUS_POR_CODIGO: Record<string, StatusConteudo> = {
  draft: STATUS_CONTEUDO.RASCUNHO,
  in_review: STATUS_CONTEUDO.EM_REVISAO,
  returned: STATUS_CONTEUDO.DEVOLVIDO,
  rejected: STATUS_CONTEUDO.REJEITADO,
  published: STATUS_CONTEUDO.PUBLICADO,
  archived: STATUS_CONTEUDO.DESPUBLICADO,
};

const TIPO_POR_CODIGO: Record<string, TipoConteudo> = {
  text: TIPO_CONTEUDO.ARTIGO,
  video: TIPO_CONTEUDO.VIDEO,
  pdf: TIPO_CONTEUDO.PDF,
};

/** Ação do painel → `content_review_action`. */
const VERBO_POR_ACAO: Record<AcaoRevisao, string> = {
  [ACAO_REVISAO.APROVAR]: "approve",
  [ACAO_REVISAO.DEVOLVER]: "return",
  [ACAO_REVISAO.REJEITAR]: "reject",
  [ACAO_REVISAO.DESPUBLICAR]: "unpublish",
};

const ACAO_POR_VERBO: Record<string, AcaoRevisao> = Object.fromEntries(
  Object.entries(VERBO_POR_ACAO).map(([acao, verbo]) => [verbo, acao as AcaoRevisao]),
) as Record<string, AcaoRevisao>;

/* -------------------------------------------------------------------------
   PROJEÇÃO
   ------------------------------------------------------------------------- */

const SELECT_VERSAO = `
  id,
  content_item_id,
  version_no,
  title,
  body,
  media_kind,
  video_url,
  estimated_reading_minutes,
  status,
  created_at,
  updated_at,
  content_items (
    id,
    authored_by,
    accounts:authored_by ( full_name, email ),
    content_categories ( id, label, specialties ( code, is_confidential ) ),
    content_cid10 ( cid10 ( code, label ) )
  )
`;

interface LinhaEspecialidade {
  code: string;
  is_confidential: boolean;
}

interface LinhaCategoria {
  id: string;
  label: string;
  specialties: LinhaEspecialidade | LinhaEspecialidade[] | null;
}

interface LinhaConta {
  full_name: string | null;
  email: string;
}

interface LinhaCid {
  code: string;
  label: string;
}

interface LinhaVersao {
  id: string;
  content_item_id: string;
  version_no: number;
  title: string;
  body: string;
  media_kind: string;
  video_url: string | null;
  estimated_reading_minutes: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  content_items: {
    id: string;
    authored_by: string | null;
    accounts: LinhaConta | LinhaConta[] | null;
    content_categories: LinhaCategoria | LinhaCategoria[] | null;
    content_cid10: { cid10: LinhaCid | LinhaCid[] | null }[] | null;
  } | null;
}

/** Primeiras linhas do corpo — o cartão da fila mostra do que o texto trata. */
function resumir(corpo: string, limite = 160): string {
  const limpo = corpo.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;

  // Corta na palavra, não no meio dela.
  return `${limpo.slice(0, limite).replace(/\s+\S*$/, "")}…`;
}

function nomeDe(conta: LinhaConta | null, ausente: string): string {
  return conta?.full_name?.trim() || conta?.email || ausente;
}

function projetar(linha: LinhaVersao): ConteudoListItem {
  const item = umDe(linha.content_items);
  const categoria = umDe(item?.content_categories);
  const areaDaCategoria = umDe(categoria?.specialties);

  return {
    id: linha.id,
    orientacao_id: linha.content_item_id,
    titulo: linha.title,
    resumo: resumir(linha.body),
    versao: Number(linha.version_no),
    status: STATUS_POR_CODIGO[linha.status] ?? STATUS_CONTEUDO.RASCUNHO,
    tipo: TIPO_POR_CODIGO[linha.media_kind] ?? TIPO_CONTEUDO.ARTIGO,
    categoria: categoria?.label ?? "Sem categoria",
    categoria_id: categoria?.id ?? "",
    especialidade: paraEspecialidade(areaDaCategoria?.code),
    confidencial: areaDaCategoria?.is_confidential ?? false,
    autor_nome: nomeDe(umDe(item?.accounts), "Autoria não identificada"),
    autor_id: item?.authored_by ?? null,
    criado_em: linha.created_at,
    atualizado_em: linha.updated_at,
    // Favorito e leitura vivem em `patient_content_states`, e nem a
    // administração nem a equipe têm política de leitura ali: a biblioteca de
    // quem se trata é do paciente. A contagem de acessos do protótipo não tem
    // origem — e `null` faz a tela dizer isso, em vez de estampar um zero que
    // parece medição.
    visualizacoes: null,
  };
}

/** Histórico de decisões de uma versão. Falha aqui não derruba a ficha. */
async function lerRevisoes(versaoId: string): Promise<RevisaoConteudo[]> {
  const { data, error } = await getSupabaseClient()
    .from("content_version_reviews")
    .select("id, action, comment, created_at, accounts:reviewer_account_id ( full_name, email )")
    .eq("content_version_id", versaoId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const linhas = data as unknown as {
    id: string;
    action: string;
    comment: string | null;
    created_at: string;
    accounts: LinhaConta | LinhaConta[] | null;
  }[];

  return linhas.map((linha) => ({
    id: linha.id,
    acao: ACAO_POR_VERBO[linha.action] ?? ACAO_REVISAO.APROVAR,
    revisor_nome: nomeDe(umDe(linha.accounts), "Revisor não identificado"),
    comentario: linha.comment,
    criado_em: linha.created_at,
  }));
}

async function detalhar(linha: LinhaVersao): Promise<ConteudoDetalhe> {
  const item = umDe(linha.content_items);

  const cids = (item?.content_cid10 ?? [])
    .map((vinculo) => umDe(vinculo.cid10))
    .filter((cid): cid is LinhaCid => cid !== null);

  return {
    ...projetar(linha),
    corpo: linha.body,
    video_url: linha.video_url,
    minutos_leitura: linha.estimated_reading_minutes,
    cids,
    revisoes: await lerRevisoes(linha.id),
  };
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

const CAMPOS_BUSCA = ["titulo", "resumo", "categoria", "autor_nome"];
const ORDENACAO_PADRAO = { field: "atualizado_em", direction: "desc" } as const;

/**
 * Todas as versões visíveis à equipe.
 *
 * A projeção depende de vínculos (categoria, especialidade, autor), então o
 * recorte acontece depois dela — pelo mesmo motivo que em Usuários: filtrar no
 * servidor por um campo que só existe depois do join devolveria `count` errado,
 * e um "1–20 de N" com N errado é pior do que uma consulta a mais numa base do
 * tamanho de uma clínica.
 */
export async function list(params: ListParams = {}): Promise<ListResult<ConteudoListItem>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("content_versions")
      .select(SELECT_VERSAO)
      .order("updated_at", { ascending: false });

    if (error) return falhaDe(error);

    const versoes = (data as unknown as LinhaVersao[]).map(projetar);

    return paginate(
      versoes,
      { ...params, sort: params.sort ?? ORDENACAO_PADRAO },
      { searchFields: CAMPOS_BUSCA },
    );
  });
}

export async function getById({ id }: { id: string }): Promise<SingleResult<ConteudoDetalhe>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("content_versions")
      .select(SELECT_VERSAO)
      .eq("id", id)
      .maybeSingle();

    if (error) return falhaDe(error);
    if (!data) return fail(ERROR_CODE.NOT_FOUND, "Versão de conteúdo não encontrada.");

    return okOne(await detalhar(data as unknown as LinhaVersao));
  });
}

/** Todas as versões de uma orientação, da mais recente para a mais antiga. */
export async function listVersions({
  id,
  ...params
}: { id: string } & ListParams): Promise<ListResult<ConteudoListItem>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient()
      .from("content_versions")
      .select(SELECT_VERSAO)
      .eq("content_item_id", id)
      .order("version_no", { ascending: false });

    if (error) return falhaDe(error);

    return paginate((data as unknown as LinhaVersao[]).map(projetar), {
      ...params,
      sort: params.sort ?? { field: "versao", direction: "desc" },
    });
  });
}

/* -------------------------------------------------------------------------
   DECISÃO DE REVISÃO — o núcleo do workflow
   ------------------------------------------------------------------------- */

/**
 * Aplica uma decisão a uma versão.
 *
 * Devolver e rejeitar exigem comentário; a checagem é repetida aqui, antes da
 * ida ao servidor, para que a recusa chegue como validação de formulário e não
 * como erro de banco. A trava real continua sendo a do banco — esta é
 * conveniência, não segurança.
 */
export async function revisar({
  id,
  acao,
  comentario,
}: {
  id: string;
  acao: AcaoRevisao;
  comentario?: string;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return executar(async () => {
    const texto = comentario?.trim() ?? "";

    if ((acao === ACAO_REVISAO.DEVOLVER || acao === ACAO_REVISAO.REJEITAR) && texto === "") {
      return fail(
        ERROR_CODE.VALIDATION,
        "Devolver e rejeitar exigem um comentário explicando o que precisa mudar.",
      );
    }

    const { error } = await getSupabaseClient().rpc("review_content_version", {
      p_content_version_id: id,
      p_action: VERBO_POR_ACAO[acao],
      p_comment: texto || null,
    });

    if (error) return falhaDe(error);

    return getById({ id });
  });
}

export async function publish({ id }: { id: string }): Promise<SingleResult<ConteudoDetalhe>> {
  return revisar({ id, acao: ACAO_REVISAO.APROVAR });
}

export async function unpublish({
  id,
  motivo,
}: {
  id: string;
  motivo?: string;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return revisar({ id, acao: ACAO_REVISAO.DESPUBLICAR, comentario: motivo });
}

/* -------------------------------------------------------------------------
   COMPARAÇÃO ENTRE VERSÕES
   ------------------------------------------------------------------------- */

/**
 * A versão em revisão e a imediatamente anterior.
 *
 * Comparar é o que torna a aprovação uma decisão informada: sem a versão
 * anterior ao lado, aprovar a versão 4 de um texto obriga a reler as quatro. A
 * comparação é textual e acontece na tela — não há inferência nenhuma aqui, só
 * duas colunas de texto.
 */
export async function getDiff({ id }: { id: string }): Promise<SingleResult<ComparacaoVersoes>> {
  return executar(async () => {
    const atual = await getById({ id });

    // O erro é repassado, não embrulhado: quem chamou precisa do código
    // original — `FORBIDDEN` e `NOT_FOUND` levam a telas diferentes.
    if (atual.error) return fail(atual.error.code, atual.error.message, atual.error.details);
    if (!atual.data) return fail(ERROR_CODE.NOT_FOUND, "Versão de conteúdo não encontrada.");

    const { data, error } = await getSupabaseClient()
      .from("content_versions")
      .select(SELECT_VERSAO)
      .eq("content_item_id", atual.data.orientacao_id)
      .lt("version_no", atual.data.versao)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return falhaDe(error);

    return okOne({
      atual: atual.data,
      anterior: data ? await detalhar(data as unknown as LinhaVersao) : null,
    });
  });
}

/* -------------------------------------------------------------------------
   O QUE O BACKEND NÃO OFERECE A UM ADMINISTRADOR
   -------------------------------------------------------------------------
   Escrever orientação é do profissional da área: as políticas de INSERT de
   `content_items` e `content_versions` exigem que o autor seja o próprio
   profissional autenticado, e a de UPDATE só libera rascunho e devolvido, ao
   autor. Não é lacuna — é a separação entre quem redige e quem aprova, que é a
   razão de o workflow existir.
   ------------------------------------------------------------------------- */

const SO_O_AUTOR =
  "Quem redige a orientação é o profissional da área, no espaço de trabalho dele. O painel administrativo revisa, aprova e despublica.";

export async function create(): Promise<SingleResult<ConteudoDetalhe>> {
  return fail(ERROR_CODE.FORBIDDEN, SO_O_AUTOR);
}

export async function update(): Promise<SingleResult<ConteudoDetalhe>> {
  return fail(ERROR_CODE.FORBIDDEN, SO_O_AUTOR);
}

export async function submitForReview(): Promise<SingleResult<ConteudoDetalhe>> {
  return fail(
    ERROR_CODE.FORBIDDEN,
    "Enviar para revisão é o ato de quem escreveu — é assim que o texto entra nesta fila.",
  );
}
