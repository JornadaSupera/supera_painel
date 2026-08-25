import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
});
