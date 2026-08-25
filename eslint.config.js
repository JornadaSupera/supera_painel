import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

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
      // Estas regras são o que torna a barreira do adapter verificável em vez de
      // apenas documentada: sem elas, basta um import direto para que a
      // Fase 15 deixe de ser "trocar uma variável de ambiente".
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/mocks/*", "@/mocks/*"],
              message: "Página/componente nunca importa mock direto. Use @/services/apiClient.",
            },
            {
              group: ["@supabase/supabase-js"],
              message:
                "Supabase só pode ser importado em services/adapters/supabase. Use @/services/apiClient.",
            },
          ],
        },
      ],

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

  // A camada de dados PODE tocar mocks e supabase — é o trabalho dela.
  {
    files: ["src/services/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  // Primitivos gerados pelo CLI do shadcn: não são nosso código-fonte.
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
);
