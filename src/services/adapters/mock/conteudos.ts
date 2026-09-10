import {
  ACAO_REVISAO,
  STATUS_CONTEUDO,
  type AcaoRevisao,
  type StatusConteudo,
} from "@/lib/enums";
import { conteudos, revisoes, type ConteudoRaw } from "@/mocks/conteudos";
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
import { now, paginate, simulate, uuid } from "./_helpers";

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

function resumir(corpo: string, limite = 160): string {
  const limpo = corpo.replace(/\s+/g, " ").trim();
  if (limpo.length <= limite) return limpo;
  return `${limpo.slice(0, limite).replace(/\s+\S*$/, "")}…`;
}

function projetar(linha: ConteudoRaw): ConteudoListItem {
  return {
    id: linha.id,
    orientacao_id: linha.content_item_id,
    titulo: linha.title,
    resumo: resumir(linha.body),
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
    // O mock TEM a contagem porque o protótipo a mostra. O Supabase devolve
    // `null` — a tabela de leitura do paciente não é legível pela administração.
    // A diferença é real e está documentada nos dois adapters.
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

function detalhar(linha: ConteudoRaw): ConteudoDetalhe {
  return {
    ...projetar(linha),
    corpo: linha.body,
    video_url: linha.video_url,
    minutos_leitura: linha.estimated_reading_minutes,
    cids: linha.cid10,
    revisoes: revisoesDe(linha.id),
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

    if ((acao === ACAO_REVISAO.DEVOLVER || acao === ACAO_REVISAO.REJEITAR) && texto === "") {
      return fail(
        ERROR_CODE.VALIDATION,
        "Devolver e rejeitar exigem um comentário explicando o que precisa mudar.",
      );
    }

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
   ESCRITA DO AUTOR
   -------------------------------------------------------------------------
   O mock RECUSA criar e editar, igual ao Supabase — e pela mesma razão de
   produto, não por falta de implementação: quem redige é o profissional da
   área, e o painel administrativo revisa. Um mock que aceitasse aqui faria a
   tela prometer um botão que o backend real nega.
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
