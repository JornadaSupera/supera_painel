import { ERROR_CODE, fail, type ErrorCode, type FailResult } from "@/services/contracts";
import { mapSupabaseError } from "./client";

/**
 * Infra compartilhada do adapter Supabase.
 *
 * Faz o que `mock/_helpers.ts` faz do outro lado: garante que toda operação
 * responda no formato do contrato, inclusive quando algo estoura. Uma exceção
 * que escapa daqui vira tela branca; um `{ error }` chega ao `ErrorState`.
 */

/** Forma mínima de um erro do PostgREST ou de uma exceção levantada em PL/pgSQL. */
export interface ErroPostgrest {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

/**
 * Códigos que o PostgREST devolve e que `mapSupabaseError` não cobre, por
 * serem específicos de chamada de função — o caminho que este adapter usa para
 * quase tudo que é clínico.
 */
const CODIGO_EXTRA: Record<string, ErrorCode> = {
  // Função inexistente ou nome de parâmetro errado. É defeito nosso, não do
  // usuário: a assinatura tem que bater exatamente com a do banco.
  PGRST202: ERROR_CODE.NOT_IMPLEMENTED,
  // `raise exception` sem SQLSTATE próprio — o padrão do PL/pgSQL. As RPCs do
  // projeto usam isso para regra de negócio.
  P0001: ERROR_CODE.VALIDATION,
  // Violação de chave estrangeira. No desenho deste banco é quase sempre
  // "a linha pai não existe ou não é sua".
  "23503": ERROR_CODE.VALIDATION,
};

export function traduzirErro(erro: ErroPostgrest | null | undefined): ErrorCode {
  if (!erro) return ERROR_CODE.UNKNOWN;

  const extra = erro.code ? CODIGO_EXTRA[erro.code] : undefined;
  return extra ?? mapSupabaseError(erro) ?? ERROR_CODE.UNKNOWN;
}

/**
 * Mensagem a exibir.
 *
 * O `HINT` das funções deste banco é escrito para ser lido por quem opera o
 * painel — "peça a outro administrador", "promova outro antes de desativá-lo".
 * Quando existe, é melhor do que qualquer texto genérico nosso. Sem ele, o
 * contrato usa a mensagem padrão do código de erro.
 */
export function mensagemDoErro(erro: ErroPostgrest | null | undefined): string | undefined {
  return erro?.hint?.trim() || undefined;
}

/** Converte um erro do PostgREST em resposta de falha do contrato. */
export function falhaDe(erro: ErroPostgrest | null | undefined): FailResult {
  return fail(traduzirErro(erro), mensagemDoErro(erro), {
    code: erro?.code,
    message: erro?.message,
  });
}

/**
 * Envelope de toda operação do adapter.
 *
 * Sem isto, um `throw` de dentro do supabase-js (rede caída, sessão ausente,
 * JSON malformado) sobe pelo `queryFn` como exceção crua e a tela perde a
 * distinção entre "erro do backend" e "defeito do painel".
 */
export async function executar<T>(operacao: () => Promise<T>): Promise<T | FailResult> {
  try {
    return await operacao();
  } catch (erro) {
    if (erro instanceof Error && /Failed to fetch|NetworkError/i.test(erro.message)) {
      return fail(ERROR_CODE.NETWORK);
    }

    return fail(ERROR_CODE.UNKNOWN, undefined, {
      message: erro instanceof Error ? erro.message : String(erro),
    });
  }
}

/**
 * Achata um vínculo embutido do PostgREST.
 *
 * A forma do retorno depende de uma constraint do banco, não da consulta: com
 * unicidade na chave estrangeira o PostgREST entende relação um-para-um e
 * devolve um OBJETO; sem ela, devolve um ARRAY. É por isso que o mesmo
 * `select` responde de duas formas conforme a tabela.
 *
 * O modo de errar é silencioso e caro: indexar `[0]` num objeto devolve
 * `undefined`, então o vínculo simplesmente "não existe" — sem erro, sem log,
 * e a tela mostra uma lista vazia que parece problema de permissão.
 */
export function umDe<T>(vinculo: T | T[] | null | undefined): T | null {
  if (!vinculo) return null;
  return Array.isArray(vinculo) ? (vinculo[0] ?? null) : vinculo;
}

/**
 * Teto de linhas das funções `read_*`. É imposto no servidor — pedir mais não
 * traz mais, e o painel precisa saber disso para não prometer paginação que
 * não existe.
 */
export const TETO_READ = 200;

/** ISO 8601 UTC — o único formato de data que a camada de dados usa. */
export function paraIso(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}
