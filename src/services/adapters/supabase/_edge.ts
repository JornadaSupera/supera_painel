import { SUPABASE } from "@/lib/env";
import { ERROR_CODE, fail, okOne, type ErrorCode, type FailResult, type SingleResult } from "@/services/contracts";
import { mensagemDaSentinela } from "./_helpers";
import { getSupabaseClient } from "./client";

/**
 * Chamada a uma Edge Function do projeto, no formato do contrato.
 *
 * As funções respondem `{ error: "<sentinela>" }` no corpo, com o status HTTP
 * só como apoio — não trazem `HINT` nem `code` do Postgres, então o caminho de
 * tradução do PostgREST (`falhaDe`) não serve aqui. O vocabulário de frases é o
 * mesmo (`mensagemDaSentinela`); o que muda é a forma de chegar nele.
 *
 * O corpo da falha pode trazer mais do que o nome — `invite_failed` devolve o
 * `account_id` da conta que ficou criada, e `reset_failed` devolve quantos
 * fatores já tinham saído. Isso segue em `details`, para a tela oferecer o
 * reenvio em vez de só dizer que falhou.
 */

/** Código do contrato de cada recusa conhecida. O que não está aqui vira UNKNOWN. */
const CODIGO_DA_FUNCAO: Record<string, ErrorCode> = {
  unauthorized: ERROR_CODE.UNAUTHORIZED,
  forbidden: ERROR_CODE.FORBIDDEN,
  mfa_required: ERROR_CODE.MFA_REQUIRED,
  cannot_reset_own_factor: ERROR_CODE.FORBIDDEN,

  invalid_email: ERROR_CODE.VALIDATION,
  invalid_name: ERROR_CODE.VALIDATION,
  invalid_role: ERROR_CODE.VALIDATION,
  council_registration_required: ERROR_CODE.VALIDATION,
  specialty_required: ERROR_CODE.VALIDATION,
  unknown_specialty: ERROR_CODE.VALIDATION,
  primary_specialty_not_in_list: ERROR_CODE.VALIDATION,

  email_in_use: ERROR_CODE.CONFLICT,
  account_is_patient: ERROR_CODE.CONFLICT,
  account_is_caregiver: ERROR_CODE.CONFLICT,
  professional_already_registered: ERROR_CODE.CONFLICT,
  staff_invitation_pending: ERROR_CODE.CONFLICT,

  staff_invitation_not_found: ERROR_CODE.NOT_FOUND,
  staff_account_not_found: ERROR_CODE.NOT_FOUND,

  rate_limited: ERROR_CODE.RATE_LIMITED,
};

/** O que o corpo de uma recusa pode trazer além do nome. */
type CorpoDeErro = { error?: string } & Record<string, unknown>;

/**
 * A chamada é feita com `fetch`, e não com `supabase.functions.invoke`, de
 * propósito.
 *
 * O cliente do painel manda `x-application-name` em toda requisição (é como o
 * servidor identifica quem chamou), e `invoke` repassa esse cabeçalho. As
 * funções respondem ao preflight de CORS permitindo só `authorization`,
 * `x-client-info`, `apikey` e `content-type`: o navegador então **bloqueia a
 * chamada antes de ela sair**, e o que chega à tela é "Failed to fetch" — igual
 * a uma rede caída. Medido em homologação: com o cabeçalho, bloqueada; sem ele,
 * 401 normal.
 *
 * Aqui seguem só os quatro cabeçalhos que a função aceita. O token é o da
 * sessão atual, lido no momento da chamada — depois de `elevarSessao`, já é o
 * de dois fatores.
 */
export async function chamarFuncao<T>(nome: string, corpo: Record<string, unknown>): Promise<SingleResult<T>> {
  const { data: sessao } = await getSupabaseClient().auth.getSession();
  const token = sessao.session?.access_token;
  if (!token) return fail(ERROR_CODE.UNAUTHORIZED, "Sua sessão expirou. Entre de novo para continuar.");

  let resposta: Response;
  try {
    resposta = await fetch(`${SUPABASE.url}/functions/v1/${nome}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        apikey: SUPABASE.anonKey,
      },
      body: JSON.stringify(corpo),
    });
  } catch {
    return fail(ERROR_CODE.NETWORK);
  }

  let conteudo: unknown = null;
  try {
    conteudo = await resposta.json();
  } catch {
    // Corpo vazio ou que não é JSON: o status é tudo o que há.
  }

  if (resposta.ok) return okOne(conteudo as T);

  return falhaDaFuncao(conteudo as CorpoDeErro | null);
}

function falhaDaFuncao(corpo: CorpoDeErro | null): FailResult {
  const sentinela = corpo?.error;
  if (!sentinela) return fail(ERROR_CODE.UNKNOWN);

  return fail(
    CODIGO_DA_FUNCAO[sentinela] ?? ERROR_CODE.UNKNOWN,
    mensagemDaSentinela(sentinela),
    // O corpo inteiro segue em `details` (o nome em `sentinela`, mais o que a
    // função devolveu junto), para a tela decidir sem reler a mensagem.
    { ...corpo, sentinela },
  );
}
