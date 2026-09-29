import { attachmentError, safeAttachmentName } from "@/lib/attachments";
import { isEditableStatus } from "@/lib/content";
import {
  ACAO_REVISAO,
  STATUS_CONTEUDO,
  TIPO_CONTEUDO,
  type AcaoRevisao,
  type StatusConteudo,
} from "@/lib/enums";
import { cids as catalogoCids } from "@/mocks/cids";
import { CATEGORIAS, conteudos, revisoes, type ConteudoRaw } from "@/mocks/conteudos";
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
import { now, paginate, simulate, uuid } from "./_helpers";
import { autorDaSessao } from "./auth";

/**
 * Conteúdo — mesma superfície do adapter Supabase, sobre arrays.
 *
 * O que o backend real faz por RPC, aqui é mutação de array: a decisão troca o
 * status da versão, arquiva a que estava publicada e registra a linha de
 * histórico. Reproduzir o efeito COLATERAL do banco importa tanto quanto
 * reproduzir o retorno — sem arquivar a versão anterior ao aprovar, a tela
 * mostraria duas versões publicadas da mesma orientação, que é um estado que o
 * banco não permite existir.
 */

const CAMPOS_BUSCA = ["titulo", "resumo", "categoria", "autor_nome"];
const ORDENACAO_PADRAO = { field: "atualizado_em", direction: "desc" } as const;

/** Estado vivo da sessão: as decisões tomadas na tela persistem até recarregar. */
const versoes: ConteudoRaw[] = conteudos.map((linha) => ({ ...linha }));
const historico = revisoes.map((linha) => ({ ...linha }));

function projetar(linha: ConteudoRaw): ConteudoListItem {
  return {
    id: linha.id,
    orientacao_id: linha.content_item_id,
    titulo: linha.title,
    resumo: summarizeBody(linha.body),
    versao: linha.version_no,
    status: linha.status,
    tipo: linha.media_kind,
    categoria: linha.category_label,
    categoria_id: linha.category_id,
    especialidade: linha.specialty,
    confidencial: linha.is_confidential,
    autor_nome: linha.author_name,
    autor_id: linha.author_id,
    criado_em: linha.created_at,
    atualizado_em: linha.updated_at,
    // O Supabase também tem a contagem agora, via `summarize_content_reads` —
    // ver `contagemDeLeituras` no outro adapter. `null` continua existindo lá
    // como "a chamada falhou nesta consulta", não como "não há origem".
    visualizacoes: linha.view_count,
  };
}

function revisoesDe(versaoId: string): RevisaoConteudo[] {
  return historico
    .filter((linha) => linha.content_version_id === versaoId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((linha) => ({
      id: linha.id,
      acao: linha.action as AcaoRevisao,
      revisor_nome: linha.reviewer_name,
      comentario: linha.comment,
      criado_em: linha.created_at,
    }));
}

/** Anexos e conteúdo dos arquivos enviados nesta sessão. Somem ao recarregar, como o resto do mock. */
const anexosPorVersao = new Map<string, AnexoConteudo[]>();
const arquivosEnviados = new Map<string, Blob>();

function detalhar(linha: ConteudoRaw): ConteudoDetalhe {
  const revisoesDaVersao = revisoesDe(linha.id);
  const base = projetar(linha);

  return {
    ...base,
    status: statusForAuthor(base.status, revisoesDaVersao[0]?.acao ?? null),
    corpo: linha.body,
    video_url: linha.video_url,
    minutos_leitura: linha.estimated_reading_minutes,
    cids: linha.cid10,
    revisoes: revisoesDaVersao,
    anexos: anexosPorVersao.get(linha.id) ?? [],
  };
}

function acharPorId(id: string): ConteudoRaw | undefined {
  return versoes.find((linha) => linha.id === id);
}

/* -------------------------------------------------------------------------
   LEITURA
   ------------------------------------------------------------------------- */

export async function list(params: ListParams = {}): Promise<ListResult<ConteudoListItem>> {
  return simulate(() =>
    paginate(
      versoes.map(projetar),
      { ...params, sort: params.sort ?? ORDENACAO_PADRAO },
      { searchFields: CAMPOS_BUSCA },
    ),
  );
}

export async function getById({ id }: { id: string }): Promise<SingleResult<ConteudoDetalhe>> {
  return simulate(() => {
    const linha = acharPorId(id);
    if (!linha) return fail(ERROR_CODE.NOT_FOUND, "Versão de conteúdo não encontrada.");

    return okOne(detalhar(linha));
  });
}

export async function listVersions({
  id,
  ...params
}: { id: string } & ListParams): Promise<ListResult<ConteudoListItem>> {
  return simulate(() =>
    paginate(
      versoes.filter((linha) => linha.content_item_id === id).map(projetar),
      { ...params, sort: params.sort ?? { field: "versao", direction: "desc" } },
    ),
  );
}

export async function getDiff({ id }: { id: string }): Promise<SingleResult<ComparacaoVersoes>> {
  return simulate(() => {
    const atual = acharPorId(id);
    if (!atual) return fail(ERROR_CODE.NOT_FOUND, "Versão de conteúdo não encontrada.");

    const anterior = versoes
      .filter(
        (linha) =>
          linha.content_item_id === atual.content_item_id && linha.version_no < atual.version_no,
      )
      .sort((a, b) => b.version_no - a.version_no)[0];

    return okOne({
      atual: detalhar(atual),
      anterior: anterior ? detalhar(anterior) : null,
    });
  });
}

/* -------------------------------------------------------------------------
   DECISÃO DE REVISÃO
   ------------------------------------------------------------------------- */

/** Estado resultante de cada decisão — o mesmo `CASE` da função do banco. */
const STATUS_RESULTANTE: Record<AcaoRevisao, StatusConteudo> = {
  [ACAO_REVISAO.APROVAR]: STATUS_CONTEUDO.PUBLICADO,
  [ACAO_REVISAO.DEVOLVER]: STATUS_CONTEUDO.DEVOLVIDO,
  [ACAO_REVISAO.REJEITAR]: STATUS_CONTEUDO.REJEITADO,
  [ACAO_REVISAO.DESPUBLICAR]: STATUS_CONTEUDO.DESPUBLICADO,
};

export async function revisar({
  id,
  acao,
  comentario,
}: {
  id: string;
  acao: AcaoRevisao;
  comentario?: string;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return simulate(() => {
    const linha = acharPorId(id);
    if (!linha) return fail(ERROR_CODE.NOT_FOUND, "Versão de conteúdo não encontrada.");

    const texto = comentario?.trim() ?? "";

    const semComentario = missingReviewComment(acao, texto);
    if (semComentario) return semComentario;

    // Aprovar tira do ar a versão que estava publicada. É o que a função do
    // banco faz antes de publicar a nova, e por um motivo que vale nos dois
    // lados: só existe uma versão vigente por orientação.
    if (acao === ACAO_REVISAO.APROVAR) {
      for (const outra of versoes) {
        if (
          outra.content_item_id === linha.content_item_id &&
          outra.status === STATUS_CONTEUDO.PUBLICADO
        ) {
          outra.status = STATUS_CONTEUDO.DESPUBLICADO;
          outra.updated_at = now();
        }
      }
    }

    linha.status = STATUS_RESULTANTE[acao];
    linha.updated_at = now();

    historico.push({
      id: uuid(),
      content_version_id: id,
      action: acao,
      reviewer_name: "Carolina Mendes",
      comment: texto || null,
      created_at: now(),
    });

    return okOne(detalhar(linha));
  });
}

export const { publish, unpublish } = createPublishingOperations(revisar);

/* -------------------------------------------------------------------------
   AS ORIENTAÇÕES DO PRÓPRIO AUTOR
   -------------------------------------------------------------------------
   As mesmas regras do adapter real: só o autor escreve, só na categoria de uma
   especialidade dele, e só enquanto a versão é rascunho ou foi devolvida.
   ------------------------------------------------------------------------- */

const SEM_PERMISSAO_DE_AUTOR =
  "Só quem escreveu a orientação edita, e só enquanto a versão é rascunho ou foi devolvida.";

const CATEGORIA_RECUSADA = "Esta categoria não é da sua especialidade, ou está desativada.";

export async function listMine(params: ListParams = {}): Promise<ListResult<ConteudoListItem>> {
  return simulate(() => {
    const eu = autorDaSessao();
    if (!eu) return fail(ERROR_CODE.UNAUTHORIZED, "Entre novamente.");

    return paginate(
      versoes
        .filter((linha) => linha.author_id === eu.id)
        .map((linha) => ({
          ...projetar(linha),
          status: statusForAuthor(linha.status, revisoesDe(linha.id)[0]?.acao ?? null),
        })),
      { ...params, sort: params.sort ?? ORDENACAO_PADRAO },
      { searchFields: CAMPOS_BUSCA },
    );
  });
}

export async function listCategories(): Promise<ListResult<CategoriaConteudo>> {
  return simulate(() => {
    const eu = autorDaSessao();
    if (!eu) return fail(ERROR_CODE.UNAUTHORIZED, "Entre novamente.");

    return ok(
      CATEGORIAS.filter((categoria) => categoria.specialty === eu.especialidade).map((categoria) => ({
        id: categoria.id,
        label: categoria.label,
        especialidade: categoria.specialty,
      })),
    );
  });
}

function cidsDe(codigos: string[]): ConteudoRaw["cid10"] | ReturnType<typeof fail> {
  const unicos = [...new Set(codigos.map((c) => c.trim()).filter(Boolean))];
  const achados = unicos.map((codigo) => catalogoCids.find((cid) => cid.codigo === codigo));
  const faltam = unicos.filter((_, indice) => !achados[indice]);
  if (faltam.length > 0) return fail(ERROR_CODE.VALIDATION, `CID-10 não encontrado: ${faltam.join(", ")}.`);

  return achados.map((cid) => ({ code: cid?.codigo ?? "", label: cid?.descricao ?? "" }));
}

export async function create(entrada: ConteudoEntrada): Promise<SingleResult<ConteudoDetalhe>> {
  return simulate(() => {
    const invalida = invalidContentEntry(entrada);
    if (invalida) return invalida;

    const eu = autorDaSessao();
    if (!eu) return fail(ERROR_CODE.UNAUTHORIZED, "Entre novamente.");

    const categoria = CATEGORIAS.find((item) => item.id === entrada.categoria_id);
    if (!categoria || categoria.specialty !== eu.especialidade) {
      return fail(ERROR_CODE.FORBIDDEN, CATEGORIA_RECUSADA);
    }

    const cids = cidsDe(entrada.cids ?? []);
    if ("error" in cids) return cids;

    const agora = now();
    const linha: ConteudoRaw = {
      id: uuid(),
      content_item_id: uuid(),
      version_no: 1,
      title: entrada.titulo.trim(),
      body: entrada.corpo.trim(),
      media_kind: entrada.tipo,
      video_url: entrada.tipo === TIPO_CONTEUDO.VIDEO ? (entrada.video_url?.trim() ?? null) : null,
      estimated_reading_minutes: entrada.minutos_leitura ?? null,
      status: STATUS_CONTEUDO.RASCUNHO,
      category_label: categoria.label,
      category_id: categoria.id,
      specialty: categoria.specialty,
      is_confidential: categoria.label === "Psicologia",
      author_name: eu.nome,
      author_id: eu.id,
      cid10: cids,
      view_count: 0,
      created_at: agora,
      updated_at: agora,
    };

    versoes.push(linha);
    return okOne(detalhar(linha));
  });
}

/** A versão que a pessoa pode alterar, ou o motivo de não poder. */
function versaoEditavel(id: string): ConteudoRaw | ReturnType<typeof fail> {
  const linha = acharPorId(id);
  if (!linha) return fail(ERROR_CODE.NOT_FOUND, "Versão de conteúdo não encontrada.");

  const eu = autorDaSessao();
  if (!eu || linha.author_id !== eu.id || !isEditableStatus(linha.status)) {
    return fail(ERROR_CODE.FORBIDDEN, SEM_PERMISSAO_DE_AUTOR);
  }

  return linha;
}

export async function update({
  id,
  dados,
}: {
  id: string;
  dados: Partial<ConteudoEntrada>;
}): Promise<SingleResult<ConteudoDetalhe>> {
  return simulate(() => {
    const linha = versaoEditavel(id);
    if ("error" in linha) return linha;

    const tipoFinal = dados.tipo ?? linha.media_kind;
    const linkFinal = dados.video_url !== undefined ? dados.video_url : linha.video_url;

    const invalida = invalidContentEntry({ ...dados, tipo: tipoFinal, video_url: linkFinal });
    if (invalida) return invalida;

    const cids = dados.cids ? cidsDe(dados.cids) : null;
    if (cids && "error" in cids) return cids;

    if (dados.categoria_id) {
      const eu = autorDaSessao();
      const categoria = CATEGORIAS.find((item) => item.id === dados.categoria_id);
      if (!categoria || categoria.specialty !== eu?.especialidade) {
        return fail(ERROR_CODE.FORBIDDEN, CATEGORIA_RECUSADA);
      }
      linha.category_id = categoria.id;
      linha.category_label = categoria.label;
      linha.specialty = categoria.specialty;
      linha.is_confidential = categoria.label === "Psicologia";
    }

    if (dados.titulo !== undefined) linha.title = dados.titulo.trim();
    if (dados.corpo !== undefined) linha.body = dados.corpo.trim();
    if (dados.tipo !== undefined || dados.video_url !== undefined) {
      linha.media_kind = tipoFinal;
      linha.video_url = tipoFinal === TIPO_CONTEUDO.VIDEO ? (linkFinal?.trim() ?? null) : null;
    }
    if (dados.minutos_leitura !== undefined) linha.estimated_reading_minutes = dados.minutos_leitura;
    if (cids) linha.cid10 = cids;

    linha.updated_at = now();
    return okOne(detalhar(linha));
  });
}

export async function submitForReview({ id }: { id: string }): Promise<SingleResult<ConteudoDetalhe>> {
  return simulate(() => {
    const linha = versaoEditavel(id);
    if ("error" in linha) return linha;

    const incompleta = incompleteForReview(detalhar(linha));
    if (incompleta) return incompleta;

    linha.status = STATUS_CONTEUDO.EM_REVISAO;
    linha.updated_at = now();
    return okOne(detalhar(linha));
  });
}

/* -------------------------------------------------------------------------
   ANEXOS DA VERSÃO EM RASCUNHO
   ------------------------------------------------------------------------- */

export async function addAttachment({
  versaoId,
  arquivo,
}: {
  versaoId: string;
  arquivo: File;
}): Promise<SingleResult<AnexoConteudo>> {
  return simulate(() => {
    const motivo = attachmentError(arquivo);
    if (motivo) return fail(ERROR_CODE.VALIDATION, motivo);

    const linha = versaoEditavel(versaoId);
    if ("error" in linha) return linha;

    const nome = safeAttachmentName(arquivo.name, arquivo.type);
    const caminho = `${versaoId}/${uuid()}/${nome}`;
    const anexo: AnexoConteudo = {
      id: uuid(),
      caminho,
      nome,
      mime_type: arquivo.type,
      tamanho: arquivo.size,
    };

    arquivosEnviados.set(caminho, arquivo);
    anexosPorVersao.set(versaoId, [...(anexosPorVersao.get(versaoId) ?? []), anexo]);

    return okOne(anexo);
  });
}

export async function removeAttachment({
  versaoId,
  anexo,
}: {
  versaoId: string;
  anexo: AnexoConteudo;
}): Promise<SingleResult<null>> {
  return simulate(() => {
    const linha = versaoEditavel(versaoId);
    if ("error" in linha) return linha;

    anexosPorVersao.set(
      versaoId,
      (anexosPorVersao.get(versaoId) ?? []).filter((item) => item.id !== anexo.id),
    );
    arquivosEnviados.delete(anexo.caminho);

    return okOne(null);
  });
}

export async function downloadAttachment({
  caminho,
}: {
  caminho: string;
}): Promise<SingleResult<Blob>> {
  return simulate(() => {
    const arquivo = arquivosEnviados.get(caminho);
    if (!arquivo) return fail(ERROR_CODE.NOT_FOUND, "Não foi possível abrir este anexo.");
    return okOne(arquivo);
  });
}
