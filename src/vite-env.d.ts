/// <reference types="vite/client" />

/**
 * Tipos das variáveis de ambiente do painel.
 *
 * Declarar aqui faz o TypeScript recusar `import.meta.env.VITE_TYPO`, e dá
 * autocomplete do que existe de verdade. Toda variável nova entra nesta
 * interface e em `lib/env.ts` — nunca só no `.env`.
 */
interface ImportMetaEnv {
  readonly VITE_API_MODE?: "mock" | "supabase";

  readonly VITE_MOCK_DELAY_MIN?: string;
  readonly VITE_MOCK_DELAY_MAX?: string;
  readonly VITE_MOCK_ERROR_RATE?: string;

  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;

  readonly VITE_SESSION_IDLE_MINUTES?: string;
  readonly VITE_SESSION_WARN_MINUTES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
