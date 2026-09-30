/**
 * Guarda de build: procura por dado sensível ou de desenvolvimento no bundle.
 *
 *   node scripts/verificar-bundle.mjs
 *
 * Nada de credencial de desenvolvimento, chave de serviço, segredo ou dado
 * fictício pode aparecer no que vai para o navegador. O projeto não tem mock, e
 * esta checagem existe para que ele não volte sem que alguém perceba.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const DIST = resolve(import.meta.dirname, "..", "dist", "assets");

/** Nunca pode aparecer. */
const PROIBIDO = [
  { termo: "service_role", porque: "chave de serviço do Supabase — ignora toda a RLS" },
  { termo: "SUPABASE_SERVICE", porque: "chave de serviço do Supabase" },
  { termo: "BEGIN PRIVATE KEY", porque: "chave privada" },
  { termo: "Trocar de perfil muda", porque: "seletor de perfis de desenvolvimento" },
  { termo: "senha_mock", porque: "usuários fictícios com senha" },
  { termo: "Falha simulada de rede", porque: "adapter de mentira" },
  { termo: "Juliana Fontana", porque: "profissional fictício" },
  { termo: "Larissa Rocha", porque: "autora fictícia de conteúdo" },
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
const regras = PROIBIDO;
const achados = [];

for (const { termo, porque } of regras) {
  for (const { nome, conteudo } of arquivos) {
    if (conteudo.includes(termo)) achados.push({ termo, porque, nome });
  }
}

console.log(`Bundle verificado · ${arquivos.length} arquivos`);

if (achados.length > 0) {
  console.error("\n✗ Conteúdo indevido no bundle:\n");
  for (const { termo, porque, nome } of achados) {
    console.error(`  ${termo}`);
    console.error(`    em ${nome}`);
    console.error(`    ${porque}\n`);
  }
  process.exit(1);
}

console.log("✓ Nenhum conteúdo indevido encontrado.");
