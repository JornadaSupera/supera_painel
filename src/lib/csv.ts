/**
 * CSV export.
 *
 * The data layer decides WHICH columns come out (see `patients.export`); this
 * file only serializes and hands over the file. The split matters: if the
 * column choice lived here, changing the front-end would be enough to export a
 * field the clinic never authorized.
 *
 * Nothing here writes to the audit trail — the screen does, before asking for
 * the data, so the intent is recorded even when the download fails.
 */

const BOM = "﻿";

/**
 * Semicolon separator.
 *
 * Brazilian Excel reads the comma as a decimal separator and, with a
 * comma-separated CSV, drops the whole spreadsheet into a single column. The
 * local convention is `;` — and the BOM above is what makes Excel recognize
 * UTF-8 instead of turning "José" into "JosÃ©".
 */
const SEPARATOR = ";";

function escapeValue(value: unknown): string {
  const text = String(value ?? "");

  // Double quotes are doubled, and the whole field is wrapped when it contains
  // a separator, a quote or a line break (RFC 4180).
  return /["\n\r;,]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Turns homogeneous rows into CSV text. Column order comes from the 1st row. */
export function toCsv(rows: readonly Record<string, unknown>[]): string {
  const first = rows[0];
  if (!first) return "";

  const columns = Object.keys(first);
  const header = columns.map(escapeValue).join(SEPARATOR);
  const body = rows.map((row) => columns.map((column) => escapeValue(row[column])).join(SEPARATOR));

  return [header, ...body].join("\r\n");
}

/** "pacientes" → "pacientes-2026-08-25.csv" */
export function nameWithDate(base: string, extension = "csv"): string {
  const day = new Date().toISOString().slice(0, 10);
  return `${base}-${day}.${extension}`;
}

/** Starts the browser download and releases the temporary URL. */
export function downloadFile(content: string, name: string, type = "text/csv;charset=utf-8"): void {
  const blob = new Blob([BOM + content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();

  // Without this the blob is held until the tab closes — and it holds patient
  // data.
  URL.revokeObjectURL(url);
}

/** Shortcut: serialize and download. */
export function downloadCsv(rows: readonly Record<string, unknown>[], base: string): void {
  downloadFile(toCsv(rows), nameWithDate(base));
}
