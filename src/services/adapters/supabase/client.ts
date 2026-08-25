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

export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  if (!SUPABASE.url || !SUPABASE.anonKey) {
    throw new Error(
      "[supabase] Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de usar VITE_API_MODE=supabase.",
    );
  }

  client = createClient(SUPABASE.url, SUPABASE.anonKey, {
    auth: {
      // Painel com dado de saúde: a sessão NÃO fica em localStorage.
      // A Fase 15 injeta storage em memória + refresh via cookie httpOnly.
      persistSession: false,
      autoRefreshToken: true,
      detectSessionInUrl: false,
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
