import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE } from "@/lib/env";
import { ERROR_CODE, type ErrorCode } from "@/services/contracts";

/**
 * Cliente Supabase — criado sob demanda, apenas quando `VITE_API_MODE=supabase`.
 *
 * Enquanto o modo for `mock`, este arquivo não instancia nada: nenhuma
 * conexão, nenhum listener, nenhum custo. É só o contrato aguardando a Fase 15.
 */

let client: SupabaseClient | null = null;

/**
 * A referência do projeto, a partir da URL — `https://abc123.supabase.co` → `abc123`.
 *
 * Usada só para compor a chave de armazenamento da sessão. URL fora do formato
 * esperado devolve um rótulo neutro em vez de lançar: a aplicação não deve
 * deixar de subir por causa do nome de uma chave.
 */
function refDoProjeto(url: string): string {
  return new URL(url).hostname.split(".")[0] || "projeto";
}

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  if (!SUPABASE.url || !SUPABASE.anonKey) {
    throw new Error(
      "[supabase] Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de usar VITE_API_MODE=supabase.",
    );
  }

  client = createClient(SUPABASE.url, SUPABASE.anonKey, {
    auth: {
      /*
       * A SESSÃO SOBREVIVE A UM RECARREGAMENTO — e isso é uma troca, não um
       * descuido.
       *
       * Até aqui era `false`: nada ia para o armazenamento do navegador, e o
       * preço declarado era que recarregar encerrava a sessão. O preço não se
       * pagou como o previsto — quem opera o painel recarrega a página,
       * responde a um link colado e abre uma ficha em outra aba dezenas de
       * vezes por dia, e cada uma dessas coisas exigia digitar senha e código
       * do autenticador de novo. O caminho que isso produz não é mais seguro:
       * é a pessoa deixando de sair do painel, e a senha em papel ao lado do
       * monitor.
       *
       * O que fica guardado é o token do GoTrue, e nada além dele: nenhum dado
       * de paciente é persistido aqui nem em lugar nenhum do navegador. A
       * exposição que isso abre é a de um script hostil na própria página, que
       * com a sessão em memória teria a mesma janela — só mais curta.
       *
       * A saída definitiva é o refresh por cookie httpOnly, e ela exige um
       * servidor que o Firebase Hosting estático não dá. Enquanto não houver,
       * esta é a troca escolhida, e ela está registrada como decisão.
       */
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      /*
       * A chave é fixada no projeto em uso, em vez de deixar o padrão.
       *
       * O navegador de quem desenvolve acumula token de mais de um projeto
       * Supabase, e o padrão da biblioteca deriva a chave da URL — o que
       * funciona até alguém trocar a URL no `.env` e o app passar a ler, em
       * silêncio, a sessão do projeto errado. Fixar aqui torna isso impossível
       * de acontecer sem que a chave mude junto.
       */
      storageKey: `supera-painel.${refDoProjeto(SUPABASE.url)}.auth`,
    },
    global: {
      headers: { "x-application-name": "supera-painel-admin" },
    },
  });

  return client;
}

interface SupabaseLikeError {
  status?: number;
  code?: string;
  message?: string;
}

/**
 * Traduz o erro nativo do PostgREST para os códigos estáveis do contrato.
 * Fica aqui, e não nas telas: a tela só conhece `ErrorCode`.
 *
 * @see https://postgrest.org/en/stable/references/errors.html
 */
export function mapSupabaseError(error: SupabaseLikeError | null): ErrorCode | null {
  if (!error) return null;

  const status = error.status;

  if (status === 401 || error.code === "PGRST301") return ERROR_CODE.UNAUTHORIZED;
  if (status === 403 || error.code === "42501") return ERROR_CODE.FORBIDDEN; // violação de RLS
  if (status === 404 || error.code === "PGRST116") return ERROR_CODE.NOT_FOUND;
  if (status === 409 || error.code === "23505") return ERROR_CODE.CONFLICT; // unique_violation
  if (status === 422 || error.code === "23514") return ERROR_CODE.VALIDATION; // check_violation
  if (status === 429) return ERROR_CODE.RATE_LIMITED;
  if (error.message?.includes("Failed to fetch")) return ERROR_CODE.NETWORK;

  return ERROR_CODE.UNKNOWN;
}
