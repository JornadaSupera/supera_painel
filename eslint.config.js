import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

/**
 * FRONTEIRAS DE ARQUITETURA, VERIFICADAS
 * =============================================================================
 * As regras abaixo são o que transforma a barreira do adapter e a separação de
 * camadas em algo que falha no CI, em vez de algo que depende de disciplina.
 * Sem elas, basta um import direto para que a troca de backend deixe de ser
 * "trocar uma variável de ambiente".
 *
 * O que cada barreira impede, e por quê:
 *
 * | Barreira | O que evita |
 * |---|---|
 * | ninguém importa `mocks/` fora de `services` | dado fictício vazando para a tela, e para a build |
 * | `@supabase/supabase-js` só em `services/adapters/supabase` | o resto do projeto passar a depender de um SDK que o adapter existe para esconder |
 * | feature não importa feature | dois domínios que só compilam juntos; o comum sobe para `shared/` ou `lib/` |
 * | `components/`, `lib/`, `hooks/`, `stores/` não importam feature | camada compartilhada que só funciona dentro de um domínio |
 * | `components/ui/` não importa `services/` | primitivo do shadcn falando com a camada de dados |
 */

/** Não importar mock: vale para todo mundo fora de `services`. */
const SEM_MOCKS = {
  group: ["**/mocks/*", "@/mocks/*"],
  message: "Página/componente nunca importa mock direto. Use @/services/apiClient.",
};

/** O SDK do Supabase só existe dentro do adapter que o esconde. */
const SEM_SUPABASE = {
  group: ["@supabase/supabase-js"],
  message:
    "Supabase só pode ser importado em services/adapters/supabase. Use @/services/apiClient.",
};

/**
 * Não alcançar uma feature.
 *
 * Pega o import por alias, que é a forma como o atalho de fato aparece. Um
 * caminho relativo atravessando features (`../../usuarios/...`) não é coberto
 * por padrão de glob sem também proibir `../components/...` dentro da própria
 * feature — que é import legítimo e o mais comum do projeto.
 */
const SEM_FEATURES = {
  group: ["@/features/*/**"],
  message:
    "Camada compartilhada não conhece domínio, e feature não importa de outra feature. O que duas precisam sobe para components/shared ou lib.",
};

const SEM_SERVICES = {
  group: ["@/services/**"],
  message: "Primitivo de UI não fala com a camada de dados.",
};

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },

  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // `any` é proibido no projeto: use `unknown` e reduza o tipo.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // ------------------------------------------------------ segurança
      // `console.log` de objeto de paciente é vazamento de PHI no DevTools.
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // ------------------------------------------------------ arquitetura
      "no-restricted-imports": ["error", { patterns: [SEM_MOCKS, SEM_SUPABASE] }],

      // `dangerouslySetInnerHTML` sem sanitização, em painel que renderiza
      // conteúdo produzido por profissionais, é XSS armazenado.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Sanitize o HTML antes de renderizar e justifique com um comentário.",
        },
      ],
    },
  },

  /* ------------------------------------------------------------ camadas */

  // Uma feature não alcança outra. O comum sobe.
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [SEM_MOCKS, SEM_SUPABASE, SEM_FEATURES] }],
    },
  },

  // O compartilhado não conhece domínio: nem componente, nem lib, nem store.
  {
    files: [
      "src/components/**/*.{ts,tsx}",
      "src/lib/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
      "src/stores/**/*.{ts,tsx}",
      "src/services/**/*.{ts,tsx}",
      "src/types/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-imports": ["error", { patterns: [SEM_MOCKS, SEM_SUPABASE, SEM_FEATURES] }],
    },
  },

  // Primitivo do shadcn não fala com a camada de dados.
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [SEM_MOCKS, SEM_SUPABASE, SEM_SERVICES] }],
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },

  // A camada de dados PODE tocar mocks — é o trabalho dela. O SDK do Supabase,
  // não: ele fica restrito ao adapter que o esconde, e essa era a brecha
  // anterior (a regra estava desligada para `services/**` inteiro).
  {
    files: ["src/services/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [SEM_SUPABASE, SEM_FEATURES] }],
    },
  },

  // Aqui, e só aqui, o SDK entra.
  {
    files: ["src/services/adapters/supabase/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },
);
