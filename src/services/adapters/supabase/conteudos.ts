import { attachmentError, safeAttachmentName } from "@/lib/attachments";
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
  failWith,
  ok,
  okOne,
  type ListParams,
  type ListResult,
  type SingleResult,
} from "@/services/contracts";
import type {
  AnexoConteudo,
  CategoriaConteudo,
  ComparacaoVersoes,
  ConteudoDetalhe,
  ConteudoEntrada,
  ConteudoListItem,
  RevisaoConteudo,
} from "@/types/conteudo";
import {
  createPublishingOperations,
  incompleteForReview,
  invalidContentEntry,
  missingReviewComment,
  statusForAuthor,
  summarizeBody,
} from "../_content";
import { paginate } from "../_list";
import { executar, falhaDe, profissionalDaSessao, umDe } from "./_helpers";
import { falhou, resumirLeituraConteudo } from "./_summaries";
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
 * administrativo revisa.
 *
 * > [!] O autor escreve por INSERT/UPDATE direto, não por RPC.
 * O banco prevê assim: as políticas de `content_items`, `content_versions`,
 * `content_cid10` e `content_attachments` decidem quem escreve (o autor, na
 * categoria de uma especialidade vigente dele, e só com a versão em rascunho).
 * Um UPDATE que a política de linha não deixa passar NÃO dá erro — atinge zero
 * linhas —, então cada escrita pede as linhas de volta para poder dizer que foi
 * recusada.
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

function nomeDe(conta: LinhaConta | null, ausente: string): string {
  return conta?.full_name?.trim() || conta?.email || ausente;
}

/**
 * `leituras` vem de `contagemDeLeituras()`, uma vez por listagem — não por
 * linha. `null` quer dizer "esta consulta não buscou contagem": `detalhar` e
 * `listVersions` não exibem a coluna em lugar nenhum da tela, e chamar a RPC
 * ali pagaria um acesso auditado por um número que ninguém vê. Só `list()`
 * busca.
 *
 * Dentro do Map, ausência é zero — `summarize_content_reads` só devolve
 * linha para quem já foi lido, então um item nunca lido nunca aparece nele.
 */
function projetar(linha: LinhaVersao, leituras: Map<string, number> | null): ConteudoListItem {
  const item = umDe(linha.content_items);
  const categoria = umDe(item?.content_categories);
  const areaDaCategoria = umDe(categoria?.specialties);

  return {
    id: linha.id,
    orientacao_id: linha.content_item_id,
    titulo: linha.title,
    resumo: summarizeBody(linha.body),
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
    // Sem filtro de `confidencial` aqui, de propósito: a linha em si já não é
    // mascarada além de título e resumo (categoria, versão e status aparecem
    // normalmente para Psicologia — é a tela que esconde o texto, não esta
    // função). Um total de acessos não mascarado é consistente com o resto da
    // linha, diferente do relatório "Conteúdo mais acessado" (`relatorios.ts`),
    // que é exportável e por isso descarta confidencial no agregado inteiro.
    visualizacoes: leituras ? (leituras.get(linha.content_item_id) ?? 0) : null,
  };
}

/**
 * Quantas vezes cada orientação já foi lida, somado o acervo inteiro.
 *
 * `summarize_content_reads` é da mesma família de `summarize_appointments`:
 * soma sobre `patient_content_states` sem que nenhuma leitura de paciente
 * chegue ao navegador. Sem `p_from`/`p_to` ela soma o tempo todo — a coluna
 * "Acessos" do protótipo é histórico acumulado, não um recorte de período
 * (quem precisa do recorte é o relatório "Conteúdo mais acessado", que passa
 * a janela — ver `conteudoMaisAcessado` em `./relatorios`).
 *
 * `null` no retorno (e não um Map vazio) é o que diferencia "a chamada
 * falhou" de "ninguém leu nada ainda" — `projetar` usa a diferença para
 * escolher entre o traço de indisponível e um zero de verdade.
 */
async function contagemDeLeituras(): Promise<Map<string, number> | null> {
  const resumo = await resumirLeituraConteudo();

  if (falhou(resumo)) {
    console.error("Falha ao ler a contagem de acessos da biblioteca:", resumo.error.message);
    return null;
  }

  return new Map(resumo.linhas.map((linha) => [linha.content_item_id, Number(linha.read_count)]));
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

/**
 * Os anexos de uma versão.
 *
 * Erro aqui NÃO é engolido, ao contrário do histórico de decisões: quem edita
 * confere os anexos antes de enviar para revisão, e uma lista vazia por falha
 * levaria a anexar de novo o que já está lá.
 */
async function lerAnexos(versaoId: string): Promise<AnexoConteudo[]> {
  const { data, error } = await getSupabaseClient()
    .from("content_attachments")
    .select("id, storage_path, mime_type, byte_size")
    .eq("content_version_id", versaoId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (
    (data ?? []) as { id: string; storage_path: string; mime_type: string; byte_size: number }[]
  ).map((linha) => ({
    id: linha.id,
    caminho: linha.storage_path,
    nome: nomeDoAnexo(linha.storage_path),
    mime_type: linha.mime_type,
    tamanho: Number(linha.byte_size),
  }));
}

/** O nome do arquivo é o último trecho do caminho no bucket. */
function nomeDoAnexo(caminho: string): string {
  return caminho.slice(caminho.lastIndexOf("/") + 1);
}

async function detalhar(linha: LinhaVersao): Promise<ConteudoDetalhe> {
  const item = umDe(linha.content_items);

  const cids = (item?.content_cid10 ?? [])
    .map((vinculo) => umDe(vinculo.cid10))
    .filter((cid): cid is LinhaCid => cid !== null);

  const [revisoes, anexos] = await Promise.all([lerRevisoes(linha.id), lerAnexos(linha.id)]);
  const base = projetar(linha, null);

  return {
    ...base,
    status: statusForAuthor(base.status, revisoes[0]?.acao ?? null),
    corpo: linha.body,
    video_url: linha.video_url,
    minutos_leitura: linha.estimated_reading_minutes,
    cids,
    revisoes,
    anexos,
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
    const [{ data, error }, leituras] = await Promise.all([
      getSupabaseClient()
        .from("content_versions")
        .select(SELECT_VERSAO)
        .order("updated_at", { ascending: false }),
      contagemDeLeituras(),
    ]);

    if (error) return falhaDe(error);

    const versoes = (data as unknown as LinhaVersao[]).map((linha) => projetar(linha, leituras));

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

    return paginate((data as unknown as LinhaVersao[]).map((linha) => projetar(linha, null)), {
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

    const semComentario = missingReviewComment(acao, texto);
    if (semComentario) return semComentario;

    const { error } = await getSupabaseClient().rpc("review_content_version", {
      p_content_version_id: id,
      p_action: VERBO_POR_ACAO[acao],
      p_comment: texto || null,
    });

    if (error) return falhaDe(error);

    return getById({ id });
  });
}

export const { publish, unpublish } = createPublishingOperations(revisar);

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
    if (atual.error) return failWith(atual.error);
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
   AS ORIENTAÇÕES DO PRÓPRIO AUTOR
   ------------------------------------------------------------------------- */

/**
 * A última decisão registrada sobre cada versão — é o que diferencia um
 * rascunho novo de um devolvido, e uma versão despublicada de uma rejeitada.
 */
async function ultimaDecisaoPorVersao(
  ids: string[],
): Promise<Map<string, AcaoRevisao> | ReturnType<typeof falhaDe>> {
  const ultimas = new Map<string, AcaoRevisao>();
  if (ids.length === 0) return ultimas;

  const { data, error } = await getSupabaseClient()
    .from("content_version_reviews")
    .select("content_version_id, action, created_at")
    .in("content_version_id", ids)
    .order("created_at", { ascending: false });
  if (error) return falhaDe(error);

  for (const linha of data as { content_version_id: string; action: string }[]) {
    // Mais recente primeiro: a primeira que aparece para a versão é a última decisão.
    const acao = ACAO_POR_VERBO[linha.action];
    if (acao && !ultimas.has(linha.content_version_id)) ultimas.set(linha.content_version_id, acao);
  }

  return ultimas;
}

export async function listMine(params: ListParams = {}): Promise<ListResult<ConteudoListItem>> {
  return executar(async () => {
    const eu = await profissionalDaSessao();
    if ("error" in eu) return eu;

    const { data, error } = await getSupabaseClient()
      .from("content_versions")
      .select(SELECT_VERSAO)
      .eq("created_by_professional_id", eu.profissionalId)
      .order("updated_at", { ascending: false });
    if (error) return falhaDe(error);

    const linhas = data as unknown as LinhaVersao[];

    // Só rascunho e arquivada escondem uma decisão anterior; as outras já dizem tudo.
    const ultimas = await ultimaDecisaoPorVersao(
      linhas.filter((l) => l.status === "draft" || l.status === "archived").map((l) => l.id),
    );
    if ("error" in ultimas) return ultimas;

    const itens = linhas.map((linha) => {
      const item = projetar(linha, null);
      return { ...item, status: statusForAuthor(item.status, ultimas.get(linha.id) ?? null) };
    });

    return paginate(
      itens,
      { ...params, sort: params.sort ?? ORDENACAO_PADRAO },
      { searchFields: CAMPOS_BUSCA },
    );
  });
}

/**
 * As categorias em que o profissional pode escrever.
 *
 * A política de INSERT em `content_items` só aceita categoria ativa de uma
 * especialidade vigente do autor. Oferecer outra só levaria a uma recusa depois
 * de o texto inteiro estar escrito.
 */
export async function listCategories(): Promise<ListResult<CategoriaConteudo>> {
  return executar(async () => {
    const eu = await profissionalDaSessao();
    if ("error" in eu) return eu;

    const supabase = getSupabaseClient();

    const { data: vinculos, error: erroVinculos } = await supabase
      .from("professional_specialties")
      .select("specialty_id")
      .eq("professional_id", eu.profissionalId)
      .is("ended_at", null);
    if (erroVinculos) return falhaDe(erroVinculos);

    const areas = (vinculos as { specialty_id: string }[]).map((v) => v.specialty_id);
    if (areas.length === 0) return ok([]);

    const { data, error } = await supabase
      .from("content_categories")
      .select("id, label, specialties ( code )")
      .eq("is_active", true)
      .in("specialty_id", areas)
      .order("sort_order", { ascending: true });
    if (error) return falhaDe(error);

    const categorias = (
      data as unknown as {
        id: string;
        label: string;
        specialties: { code: string } | { code: string }[] | null;
      }[]
    ).map<CategoriaConteudo>((linha) => ({
      id: linha.id,
      label: linha.label,
      especialidade: paraEspecialidade(umDe(linha.specialties)?.code),
    }));

    return ok(categorias);
  });
}

/* -------------------------------------------------------------------------
   ESCRITA DO AUTOR
   ------------------------------------------------------------------------- */

const MEDIA_KIND_POR_TIPO: Record<TipoConteudo, string> = {
  [TIPO_CONTEUDO.ARTIGO]: "text",
  [TIPO_CONTEUDO.VIDEO]: "video",
  [TIPO_CONTEUDO.PDF]: "pdf",
};

const TIPO_POR_MEDIA_KIND = Object.fromEntries(
  Object.entries(MEDIA_KIND_POR_TIPO).map(([tipo, kind]) => [kind, tipo as TipoConteudo]),
) as Record<string, TipoConteudo>;

const SEM_PERMISSAO_DE_AUTOR =
  "Só quem escreveu a orientação edita, e só enquanto a versão é rascunho ou foi devolvida.";

const CATEGORIA_RECUSADA = "Esta categoria não é da sua especialidade, ou está desativada.";

/** Recusa de política de linha vira o motivo dito à pessoa, não "sem permissão". */
function falhaDeAutoria(erro: Parameters<typeof falhaDe>[0], motivo: string) {
  if (erro?.code === "42501") {
    return fail(ERROR_CODE.FORBIDDEN, motivo, { code: erro.code, message: erro.message });
  }
  return falhaDe(erro);
}

/** Códigos CID-10 → ids. Um código desconhecido é recusado, não ignorado. */
async function idsDosCids(codigos: string[]): Promise<string[] | ReturnType<typeof fail>> {
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  if (unicos.length === 0) return [];

  const { data, error } = await getSupabaseClient().from("cid10").select("id, code").in("code", unicos);
  if (error) return falhaDe(error);

  const achados = data as { id: string; code: string }[];
  const faltam = unicos.filter((codigo) => !achados.some((cid) => cid.code === codigo));
  if (faltam.length > 0) {
    return fail(ERROR_CODE.VALIDATION, `CID-10 não encontrado: ${faltam.join(", ")}.`);
  }

  return achados.map((cid) => cid.id);
}

/**
 * Cria a orientação e a sua primeira versão, em rascunho.
 *
 * São duas escritas (a orientação e a versão) mais os CIDs, sem transação: o
 * cliente não tem como abri-la. Tudo o que dá para conferir antes — texto,
 * vídeo, CIDs — é conferido antes, para que a falha do meio seja a exceção. Se
 * ela ocorrer, sobra uma orientação sem versão, que nenhuma lista mostra.
 */
export async function create(entrada: ConteudoEntrada): Promise<SingleResult<ConteudoDetalhe>> {
  return executar(async () => {
    const invalida = invalidContentEntry(entrada);
    if (invalida) return invalida;

    const eu = await profissionalDaSessao();
    if ("error" in eu) return eu;

    const cids = await idsDosCids(entrada.cids ?? []);
    if ("error" in cids) return cids;

    const supabase = getSupabaseClient();
    const itemId = crypto.randomUUID();
    const versaoId = crypto.randomUUID();

    const { error: erroItem } = await supabase.from("content_items").insert({
      id: itemId,
      category_id: entrada.categoria_id,
      author_professional_id: eu.profissionalId,
      authored_by: eu.contaId,
    });
    if (erroItem) return falhaDeAutoria(erroItem, CATEGORIA_RECUSADA);

    const { error: erroVersao } = await supabase.from("content_versions").insert({
      id: versaoId,
      content_item_id: itemId,
      title: entrada.titulo.trim(),
      body: entrada.corpo.trim(),
      media_kind: MEDIA_KIND_POR_TIPO[entrada.tipo],
      video_url: entrada.tipo === TIPO_CONTEUDO.VIDEO ? (entrada.video_url?.trim() ?? null) : null,
      estimated_reading_minutes: entrada.minutos_leitura ?? null,
      created_by_professional_id: eu.profissionalId,
      created_by: eu.contaId,
      status: "draft",
    });
    if (erroVersao) return falhaDeAutoria(erroVersao, SEM_PERMISSAO_DE_AUTOR);

    if (cids.length > 0) {
      const { error: erroCids } = await supabase
        .from("content_cid10")
        .insert(cids.map((cid10_id) => ({ content_item_id: itemId, cid10_id })));
      if (erroCids) return falhaDeAutoria(erroCids, SEM_PERMISSAO_DE_AUTOR);
    }

    return getById({ id: versaoId });
  });
}

/**
 * Edita o rascunho: só o que veio em `dados`.
 *
 * O UPDATE pede as linhas de volta: uma política que barra (versão já enviada,
 * ou de outro autor) não devolve erro, devolve zero linhas.
 */
export async function update({
  id,
  dados,
}: {
  id: string;
  dados: Partial<ConteudoEntrada>;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { data: atual, error: erroAtual } = await supabase
      .from("content_versions")
      .select("content_item_id, media_kind, video_url")
      .eq("id", id)
      .maybeSingle();
    if (erroAtual) return falhaDe(erroAtual);
    if (!atual) return fail(ERROR_CODE.NOT_FOUND, "Versão de conteúdo não encontrada.");

    const versao = atual as { content_item_id: string; media_kind: string; video_url: string | null };

    // O tipo e o link se conferem juntos: trocar para vídeo sem link, ou deixar
    // o link de um vídeo que virou texto, são as duas metades do mesmo erro.
    const tipoFinal = dados.tipo ?? TIPO_POR_MEDIA_KIND[versao.media_kind] ?? TIPO_CONTEUDO.ARTIGO;
    const linkFinal = dados.video_url !== undefined ? dados.video_url : versao.video_url;

    const invalida = invalidContentEntry({ ...dados, tipo: tipoFinal, video_url: linkFinal });
    if (invalida) return invalida;

    const cids = dados.cids ? await idsDosCids(dados.cids) : null;
    if (cids && "error" in cids) return cids;

    const alteracoes: Record<string, unknown> = {};
    if (dados.titulo !== undefined) alteracoes.title = dados.titulo.trim();
    if (dados.corpo !== undefined) alteracoes.body = dados.corpo.trim();
    if (dados.tipo !== undefined || dados.video_url !== undefined) {
      alteracoes.media_kind = MEDIA_KIND_POR_TIPO[tipoFinal];
      alteracoes.video_url = tipoFinal === TIPO_CONTEUDO.VIDEO ? (linkFinal?.trim() ?? null) : null;
    }
    if (dados.minutos_leitura !== undefined) {
      alteracoes.estimated_reading_minutes = dados.minutos_leitura;
    }

    if (Object.keys(alteracoes).length > 0) {
      const { data, error } = await supabase
        .from("content_versions")
        .update(alteracoes)
        .eq("id", id)
        .select("id");
      if (error) return falhaDeAutoria(error, SEM_PERMISSAO_DE_AUTOR);
      if (!data || data.length === 0) return fail(ERROR_CODE.FORBIDDEN, SEM_PERMISSAO_DE_AUTOR);
    }

    if (dados.categoria_id) {
      const { data, error } = await supabase
        .from("content_items")
        .update({ category_id: dados.categoria_id })
        .eq("id", versao.content_item_id)
        .select("id");
      if (error) return falhaDeAutoria(error, CATEGORIA_RECUSADA);
      if (!data || data.length === 0) return fail(ERROR_CODE.FORBIDDEN, SEM_PERMISSAO_DE_AUTOR);
    }

    if (cids) {
      const { data: vigentes, error: erroVigentes } = await supabase
        .from("content_cid10")
        .select("cid10_id")
        .eq("content_item_id", versao.content_item_id);
      if (erroVigentes) return falhaDe(erroVigentes);

      const atuais = new Set((vigentes as { cid10_id: string }[]).map((v) => v.cid10_id));
      const novos = new Set(cids);
      const sair = [...atuais].filter((cid) => !novos.has(cid));
      const entrar = [...novos].filter((cid) => !atuais.has(cid));

      if (sair.length > 0) {
        const { error } = await supabase
          .from("content_cid10")
          .delete()
          .eq("content_item_id", versao.content_item_id)
          .in("cid10_id", sair);
        if (error) return falhaDeAutoria(error, SEM_PERMISSAO_DE_AUTOR);
      }

      if (entrar.length > 0) {
        const { error } = await supabase
          .from("content_cid10")
          .insert(entrar.map((cid10_id) => ({ content_item_id: versao.content_item_id, cid10_id })));
        if (error) return falhaDeAutoria(error, SEM_PERMISSAO_DE_AUTOR);
      }
    }

    return getById({ id });
  });
}

/**
 * Rascunho → em revisão. O gatilho do banco confere a transição; a política só
 * deixa o autor, e só com a versão em rascunho.
 */
export async function submitForReview({
  id,
}: {
  id: string;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return executar(async () => {
    const atual = await getById({ id });
    if (atual.error) return failWith(atual.error);
    if (!atual.data) return fail(ERROR_CODE.NOT_FOUND, "Versão de conteúdo não encontrada.");

    const incompleta = incompleteForReview(atual.data);
    if (incompleta) return incompleta;

    const { data, error } = await getSupabaseClient()
      .from("content_versions")
      .update({ status: "in_review" })
      .eq("id", id)
      .select("id");
    if (error) return falhaDeAutoria(error, SEM_PERMISSAO_DE_AUTOR);
    if (!data || data.length === 0) {
      return fail(
        ERROR_CODE.FORBIDDEN,
        "Só quem escreveu a orientação a envia, e só enquanto é rascunho.",
      );
    }

    return getById({ id });
  });
}

/* -------------------------------------------------------------------------
   ANEXOS DA VERSÃO EM RASCUNHO
   ------------------------------------------------------------------------- */

const BUCKET_CONTEUDO = "content-attachments";

export async function addAttachment({
  versaoId,
  arquivo,
}: {
  versaoId: string;
  arquivo: File;
}): Promise<SingleResult<AnexoConteudo>> {
  return executar(async () => {
    const motivo = attachmentError(arquivo);
    if (motivo) return fail(ERROR_CODE.VALIDATION, motivo);

    const supabase = getSupabaseClient();

    // Uma pasta por envio: o caminho é único no banco, e dois arquivos com o
    // mesmo nome (duas capturas de tela, por exemplo) não podem colidir.
    const caminho = `${versaoId}/${crypto.randomUUID()}/${safeAttachmentName(arquivo.name, arquivo.type)}`;

    const { data: linha, error: erroLinha } = await supabase
      .from("content_attachments")
      .insert({
        content_version_id: versaoId,
        storage_path: caminho,
        mime_type: arquivo.type,
        byte_size: arquivo.size,
      })
      .select("id")
      .single();
    if (erroLinha) return falhaDeAutoria(erroLinha, SEM_PERMISSAO_DE_AUTOR);

    const anexoId = (linha as { id: string }).id;

    const { error: erroUpload } = await supabase.storage
      .from(BUCKET_CONTEUDO)
      .upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });

    if (erroUpload) {
      // A linha sem arquivo aparece como anexo quebrado. Enquanto o objeto não
      // existe o banco deixa apagá-la, e é o que se faz.
      await supabase.from("content_attachments").delete().eq("id", anexoId);
      return fail(ERROR_CODE.UNKNOWN, "O arquivo não subiu. Tente de novo.", {
        message: erroUpload.message,
      });
    }

    return okOne<AnexoConteudo>({
      id: anexoId,
      caminho,
      nome: nomeDoAnexo(caminho),
      mime_type: arquivo.type,
      tamanho: arquivo.size,
    });
  });
}

/**
 * O arquivo sai antes da linha: o banco recusa apagar a linha de um anexo cujo
 * arquivo ainda existe, para que o rastro do que foi anexado não desapareça com
 * o registro.
 */
export async function removeAttachment({
  anexo,
}: {
  versaoId: string;
  anexo: AnexoConteudo;
}): Promise<SingleResult<null>> {
  return executar(async () => {
    const supabase = getSupabaseClient();

    const { error: erroArquivo } = await supabase.storage
      .from(BUCKET_CONTEUDO)
      .remove([anexo.caminho]);
    if (erroArquivo) return fail(ERROR_CODE.UNKNOWN, "Não foi possível remover o arquivo.", { message: erroArquivo.message });

    const { data, error } = await supabase
      .from("content_attachments")
      .delete()
      .eq("id", anexo.id)
      .select("id");
    if (error) return falhaDeAutoria(error, SEM_PERMISSAO_DE_AUTOR);
    if (!data || data.length === 0) return fail(ERROR_CODE.FORBIDDEN, SEM_PERMISSAO_DE_AUTOR);

    return okOne(null);
  });
}

export async function downloadAttachment({
  caminho,
}: {
  caminho: string;
}): Promise<SingleResult<Blob>> {
  return executar(async () => {
    const { data, error } = await getSupabaseClient().storage.from(BUCKET_CONTEUDO).download(caminho);
    if (error || !data) {
      return fail(ERROR_CODE.NOT_FOUND, "Não foi possível abrir este anexo.", {
        message: error?.message,
      });
    }
    return okOne(data);
  });
}
