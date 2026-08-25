/**
 * Screen export to PDF and PNG.
 *
 * The dashboard exports a capture of itself; the twelve fixed reports export
 * PDF. Both go through `html2canvas` + `jsPDF`.
 *
 * The two libraries add real weight and are not used by most screens, so they
 * come in through a dynamic `import()` — they land in the `export` chunk,
 * loaded only when someone actually exports.
 *
 * > [!] Exporting takes clinical data out of the panel.
 * Every use goes through a permission check and is written to the audit trail.
 * The caller is responsible for that — see `lib/audit.ts`.
 */

export interface ExportOptions {
  /** Element to capture. */
  element: HTMLElement;
  /** File name, without the extension. */
  name: string;
  /** Footer text — usually who exported and when. */
  footer?: string;
  orientation?: "portrait" | "landscape";
}

/**
 * Captures the element honouring the current theme.
 *
 * `html2canvas` does not inherit the `<body>` background: without
 * `backgroundColor`, a dashboard in dark theme comes out as light text over
 * transparency — unreadable once opened.
 */
async function capture(element: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");

  const style = getComputedStyle(document.body);

  return html2canvas(element, {
    // 2× keeps the text sharp in the PDF; beyond that the file grows for
    // nothing.
    scale: 2,
    backgroundColor: style.backgroundColor || "#ffffff",
    useCORS: true,
    logging: false,
    // Elements marked `.no-print` stay out — action buttons, for instance,
    // make no sense in a static capture.
    ignoreElements: (el) => el.classList?.contains("no-print") ?? false,
  });
}

function download(blobUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Date and time for the file name: `2026-05-15_1432`. */
export function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}`
  );
}

/** Exports the element as PNG. */
export async function exportPng({ element, name }: ExportOptions): Promise<void> {
  const canvas = await capture(element);
  download(canvas.toDataURL("image/png"), `${name}.png`);
}

/**
 * Exports the element as a single-page PDF, fitted to the width.
 *
 * A long capture is scaled down to fit the sheet height instead of being cut:
 * a dashboard split in half loses exactly the comparison between indicators.
 */
export async function exportPdf({
  element,
  name,
  footer,
  orientation = "landscape",
}: ExportOptions): Promise<void> {
  const [{ default: jsPDF }, canvas] = await Promise.all([
    import("jspdf"),
    capture(element),
  ]);

  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const margin = 24;
  const footerHeight = footer ? 28 : 0;

  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - footerHeight;

  // Scale by the tightest dimension, preserving the aspect ratio.
  const scale = Math.min(usableWidth / canvas.width, usableHeight / canvas.height);
  const width = canvas.width * scale;
  const height = canvas.height * scale;

  pdf.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    margin + (usableWidth - width) / 2,
    margin,
    width,
    height,
  );

  if (footer) {
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(footer, margin, pageHeight - margin / 2);
  }

  pdf.save(`${name}.pdf`);
}
