/**
 * Exportação CSV.
 *
 * A camada de dados decide QUAIS colunas saem (ver `pacientes.export`); este
 * arquivo só serializa e entrega o arquivo. A separação importa: se a escolha
 * de colunas vivesse aqui, bastaria alterar o front para exportar campo que a
 * clínica não autorizou.
 *
 * Nenhuma chamada daqui registra auditoria — quem registra é a tela, antes de
 * pedir os dados, para que a intenção fique gravada mesmo se o download falhar.
 */

const BOM = "﻿";

/**
 * Separador ponto e vírgula.
 *
 * O Excel em português trata a vírgula como separador decimal e, com CSV
 * separado por vírgula, joga a planilha inteira numa coluna só. O padrão
 * brasileiro é `;` — e o BOM acima é o que faz o Excel reconhecer o UTF-8 e
 * não transformar "José" em "JosÃ©".
 */
const SEPARADOR = ";";

function escapar(valor: unknown): string {
  const texto = String(valor ?? "");

  // Aspas duplas viram duas aspas, e o campo inteiro é envolvido quando contém
  // separador, aspas ou quebra de linha (RFC 4180).
  return /["\n\r;,]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/** Converte linhas homogêneas em texto CSV. A ordem das colunas é a da 1ª linha. */
export function paraCsv(linhas: readonly Record<string, unknown>[]): string {
  const primeira = linhas[0];
  if (!primeira) return "";

  const colunas = Object.keys(primeira);
  const cabecalho = colunas.map(escapar).join(SEPARADOR);
  const corpo = linhas.map((linha) => colunas.map((coluna) => escapar(linha[coluna])).join(SEPARADOR));

  return [cabecalho, ...corpo].join("\r\n");
}

/** "pacientes" → "pacientes-2026-08-25.csv" */
export function nomeComData(base: string, extensao = "csv"): string {
  const dia = new Date().toISOString().slice(0, 10);
  return `${base}-${dia}.${extensao}`;
}

/** Dispara o download no navegador e libera a URL temporária. */
export function baixarArquivo(conteudo: string, nome: string, tipo = "text/csv;charset=utf-8"): void {
  const blob = new Blob([BOM + conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Sem isso o blob fica retido até a aba fechar — e ele contém dado de
  // paciente.
  URL.revokeObjectURL(url);
}

/** Atalho: serializa e baixa. */
export function baixarCsv(linhas: readonly Record<string, unknown>[], base: string): void {
  baixarArquivo(paraCsv(linhas), nomeComData(base));
}
