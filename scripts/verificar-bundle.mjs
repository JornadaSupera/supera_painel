/**
 * Guarda de build: procura por dado sensível ou de desenvolvimento no bundle.
 *
 *   node scripts/verificar-bundle.mjs
 *
 * Duas checagens distintas:
 *
 * 1. **Sempre** — nada de credencial de desenvolvimento, chave de serviço ou
 *    segredo pode aparecer no que vai para o navegador.
 *
 * 2. **Só quando `VITE_API_MODE=supabase`** — o adapter mock e os dados
 *    fictícios não podem viajar junto. Hoje eles estão no bundle de propósito:
 *    o painel roda sobre mocks, eles *são* a aplicação. Na Fase 15 isso
 *    inverte, e mandar 17 usuários fictícios com senha para produção seria,
 *    no mínimo, constrangedor.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DIST = resolve(import.meta.dirname, "..", "dist", "assets");
const MODO = process.env.VITE_API_MODE ?? "mock";

/** Nunca pode aparecer, em nenhum modo. */
const PROIBIDO_SEMPRE = [
  { termo: "service_role", porque: "chave de serviço do Supabase — ignora toda a RLS" },
  { termo: "SUPABASE_SERVICE", porque: "chave de serviço do Supabase" },
  { termo: "BEGIN PRIVATE KEY", porque: "chave privada" },
  { termo: "Trocar de perfil muda", porque: "seletor de perfis de desenvolvimento" },
];

/** Só pode aparecer enquanto o painel roda sobre mocks. */
const PROIBIDO_EM_PRODUCAO = [
  { termo: "senha_mock", porque: "usuários fictícios com senha (src/mocks/usuarios.ts)" },
  { termo: "Falha simulada de rede", porque: "adapter mock" },
];

function arquivosDoBundle() {
  try {
    return readdirSync(DIST)
      .filter((nome) => nome.endsWith(".js") || nome.endsWith(".css"))
      .map((nome) => ({ nome, conteudo: readFileSync(join(DIST, nome), "utf8") }));
  } catch {
    console.error("✗ dist/assets não encontrado. Rode `npm run build` antes.");
    process.exit(1);
  }
}

const arquivos = arquivosDoBundle();
const regras = [...PROIBIDO_SEMPRE, ...(MODO === "supabase" ? PROIBIDO_EM_PRODUCAO : [])];
const achados = [];

for (const { termo, porque } of regras) {
  for (const { nome, conteudo } of arquivos) {
    if (conteudo.includes(termo)) achados.push({ termo, porque, nome });
  }
}

console.log(`Bundle verificado · modo ${MODO} · ${arquivos.length} arquivos`);

if (achados.length > 0) {
  console.error("\n✗ Conteúdo indevido no bundle:\n");
  for (const { termo, porque, nome } of achados) {
    console.error(`  ${termo}`);
    console.error(`    em ${nome}`);
    console.error(`    ${porque}\n`);
  }
  process.exit(1);
}

if (MODO !== "supabase") {
  console.log("  Os mocks estão no bundle — esperado enquanto VITE_API_MODE=mock.");
}

console.log("✓ Nenhum conteúdo indevido encontrado.");
