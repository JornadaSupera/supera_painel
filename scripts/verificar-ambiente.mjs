#!/usr/bin/env node
/**
 * Conferencia do ambiente antes de rodar ou publicar.
 *
 *   node scripts/verificar-ambiente.mjs              # diagnostico
 *   node scripts/verificar-ambiente.mjs --producao   # falha se nao estiver pronto
 *
 * Existe por causa de uma armadilha especifica: as variaveis `VITE_*` sao
 * embutidas no bundle em tempo de BUILD, nao lidas em tempo de execucao. Um
 * `npm run build` com `VITE_API_MODE=mock` publica um painel de dados falsos
 * com cara de producao, e nada no ar denuncia isso — as telas funcionam.
 *
 * O outro caso que ele pega e o oposto: modo supabase sem a anon key, que
 * derruba a aplicacao no boot com um erro que parece defeito de codigo.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const exigeProducao = process.argv.includes("--producao");

const VERDE = "\x1b[32m";
const VERMELHO = "\x1b[31m";
const AMARELO = "\x1b[33m";
const CINZA = "\x1b[90m";
const RESET = "\x1b[0m";

/** Le um .env simples: `CHAVE=valor`, ignorando comentario e linha vazia. */
function lerEnv(caminho) {
  if (!existsSync(caminho)) return null;

  const vars = {};
  for (const linha of readFileSync(caminho, "utf8").split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;

    const igual = limpa.indexOf("=");
    if (igual === -1) continue;

    vars[limpa.slice(0, igual).trim()] = limpa.slice(igual + 1).trim();
  }
  return vars;
}

/**
 * A mesma precedencia do Vite: `.env.production` e sobrescrito por
 * `.env.local`, e o ambiente do processo vence os dois. E o que a CI usa.
 */
const arquivos = [".env.production", ".env.local"];
const doArquivo = {};
for (const arquivo of arquivos) {
  Object.assign(doArquivo, lerEnv(resolve(raiz, arquivo)) ?? {});
}

const valor = (chave) => process.env[chave] ?? doArquivo[chave] ?? "";

const modo = valor("VITE_API_MODE") || "mock";
const url = valor("VITE_SUPABASE_URL");
const chave = valor("VITE_SUPABASE_ANON_KEY");

const problemas = [];
const avisos = [];

console.log(`\n${CINZA}Origem: ${arquivos.filter((a) => existsSync(resolve(raiz, a))).join(", ") || "somente variaveis de ambiente"}${RESET}`);
console.log(`\n  VITE_API_MODE          ${modo}`);
console.log(`  VITE_SUPABASE_URL      ${url || `${CINZA}(vazia)${RESET}`}`);
console.log(
  `  VITE_SUPABASE_ANON_KEY ${chave ? `${chave.slice(0, 12)}… (${chave.length} caracteres)` : `${CINZA}(vazia)${RESET}`}`,
);

if (modo === "mock") {
  const recado =
    "O painel esta em modo mock: le dados falsos, e contas reais do banco NAO conseguem entrar.";
  if (exigeProducao) problemas.push(recado);
  else avisos.push(recado);
} else if (modo !== "supabase") {
  problemas.push(`VITE_API_MODE="${modo}" nao existe. Use "mock" ou "supabase".`);
}

if (modo === "supabase") {
  if (!url) problemas.push("VITE_SUPABASE_URL vazia: a aplicacao falha no boot.");
  if (!chave) problemas.push("VITE_SUPABASE_ANON_KEY vazia: a aplicacao falha no boot.");

  // A anon key e um JWT: tres partes separadas por ponto. Errar a chave (colar
  // a `service_role`, por exemplo) e comum, e o sintoma no navegador e opaco.
  if (chave && chave.split(".").length !== 3) {
    problemas.push("VITE_SUPABASE_ANON_KEY nao parece um JWT (esperado: tres partes separadas por ponto).");
  }

  if (chave.split(".").length === 3) {
    try {
      const corpo = JSON.parse(Buffer.from(chave.split(".")[1], "base64").toString("utf8"));
      if (corpo.role && corpo.role !== "anon") {
        problemas.push(
          `A chave informada tem role "${corpo.role}". Use a anon/public — a service_role NUNCA vai para o front-end.`,
        );
      }
    } catch {
      problemas.push("Nao foi possivel ler o conteudo da VITE_SUPABASE_ANON_KEY.");
    }
  }
}

// Uma variavel sensivel com prefixo VITE_ acaba no bundle publico.
const expostas = Object.keys({ ...process.env, ...doArquivo }).filter(
  (nome) => nome.startsWith("VITE_") && /SERVICE_ROLE|SECRET|PRIVATE/i.test(nome),
);
if (expostas.length > 0) {
  problemas.push(`Variavel sensivel exposta ao browser: ${expostas.join(", ")}.`);
}

console.log("");
for (const aviso of avisos) console.log(`${AMARELO}  aviso  ${RESET}${aviso}`);
for (const problema of problemas) console.log(`${VERMELHO}  erro   ${RESET}${problema}`);

if (problemas.length === 0 && avisos.length === 0) {
  console.log(`${VERDE}  tudo certo${RESET} — modo ${modo}.\n`);
} else if (problemas.length === 0) {
  console.log("");
}

if (problemas.length > 0) {
  console.log(
    `\n${CINZA}A anon key fica em: Supabase Dashboard > Project Settings > API Keys > anon / public${RESET}\n`,
  );
  process.exit(1);
}
