import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const STUB_DO_MOCK = fileURLToPath(
  new URL("./src/services/adapters/mock/index.stub.ts", import.meta.url),
);

/** Casa só o índice do adapter mock, pelo caminho já resolvido. */
const INDICE_DO_MOCK =
  /[\\/]src[\\/]services[\\/]adapters[\\/]mock[\\/]index\.ts$/;

/**
 * Tira o adapter mock da build quando o backend é o Supabase.
 *
 * `apiClient` importa os dois adapters e escolhe um em execução. A escolha é
 * constante na build; o import não é — então os dois eram empacotados, e com o
 * mock ia tudo que ele alcança: a base fictícia de pacientes, com nome e CPF, e
 * os usuários fictícios **com senha em texto puro**. Servido publicamente, o
 * que parece credencial é tratado como credencial por quem encontra, ainda que
 * a pessoa não exista — e o e-mail usa o domínio real da clínica.
 *
 * Redireciona pelo caminho resolvido, e não pelo texto do import: assim vale
 * para qualquer forma de importar o módulo, hoje e depois.
 *
 * Cortar o índice basta para derrubar a árvore inteira — os arquivos do mock e
 * os dados em `src/mocks/` só são alcançáveis por ele, e ficam sem referência.
 * A exceção é `mocks/permissoes.ts`, que o adapter do Supabase importa de
 * propósito: é a matriz de RBAC em vigor, não dado fictício.
 *
 * Quem impede a regressão é `npm run verify-bundle`.
 */
function excluirMocks(apiMode: string): Plugin {
  return {
    name: "supera:excluir-mocks",
    // `pre` para decidir antes do resolvedor padrão do Vite.
    enforce: "pre",
    apply: () => apiMode === "supabase",

    async resolveId(source, importer, options) {
      const alvo = await this.resolve(source, importer, {
        ...options,
        skipSelf: true,
      });
      if (!alvo || !INDICE_DO_MOCK.test(alvo.id)) return null;

      return STUB_DO_MOCK;
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Terceiro argumento vazio: sem ele `loadEnv` só devolve as `VITE_*`, e a
  // leitura continuaria correta — mas explicitar evita a surpresa no dia em
  // que a chave deixar de ter o prefixo.
  const env = loadEnv(mode, process.cwd(), "");
  const apiMode = env.VITE_API_MODE ?? "mock";

  return {
    plugins: [react(), tailwindcss(), excluirMocks(apiMode)],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    server: {
      port: 5173,
      open: true,
    },
    build: {
      // Recharts e jsPDF são pesados e não são usados no login nem na maioria
      // das telas. Separá-los mantém o carregamento inicial do painel leve.
      //
      // Forma de função (e não objeto): o objeto só reagrupa módulos que já
      // formam um chunk próprio, e com entrada única todo o grafo cai no mesmo
      // bundle. A função decide por módulo, que é o que queremos aqui.
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Só o núcleo do React recebe chunk fixo: está no caminho crítico de
            // qualquer tela e vale ter cache próprio, estável entre deploys.
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(
                id,
              )
            ) {
              return "react";
            }

            // Recharts é estaticamente importado por mais de uma rota lazy.
            // Sem esta regra o Rollup cria o chunk compartilhado assim mesmo,
            // mas o batiza com o nome do primeiro módulo que encontra — um
            // arquivo de 400 kB chamado "StatCard" engana quem for depurar.
            // Agrupar aqui é seguro: nada disso entra por import() dinâmico.
            if (
              /[\\/]node_modules[\\/](recharts|d3-|internmap|delaunator|robust-predicates|victory-)/.test(
                id,
              )
            ) {
              return "charts";
            }

            // Todo o resto fica com o Rollup.
            //
            // Um catch-all `return "vendor"` parece organizado, mas desfaz o
            // trabalho dos `import()` dinâmicos: um pacote alcançável apenas por
            // importação dinâmica — jsPDF e html2canvas, em `lib/pdf.ts` — é
            // arrastado para o bundle eager junto com o resto do vendor. O
            // resultado é pior do que não agrupar nada.
            return undefined;
          },
        },
      },
    },
  };
});
