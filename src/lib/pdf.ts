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
 * Properties that carry colours `html2canvas` reads.
 *
 * Tailwind v4 emits `oklab()`/`oklch()` (every `bg-primary/10` becomes a
 * `color-mix` that the browser resolves to `oklab`), and `html2canvas` throws on
 * any colour function it does not know — the whole export fails, not just that
 * element. So the captured clone gets each of these rewritten to plain `rgb()`.
 */
const COLOR_PROPERTIES = [
  "color",
  "background-color",
  "background-image",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "text-shadow",
  "fill",
  "stroke",
  "stop-color",
] as const;

/** `oklab(…)`, `oklch(…)`, `lab(…)`, `lch(…)` and `color(…)` — computed values never nest. */
const MODERN_COLOR = /(?:oklab|oklch|lab|lch|color)\([^()]*\)/g;

let pixel: CanvasRenderingContext2D | null = null;

/** Resolves any CSS colour to `rgb()`/`rgba()` by painting one pixel of it. */
function toRgb(color: string): string {
  pixel ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext(
    "2d",
    { willReadFrequently: true },
  );
  if (!pixel) return color;

  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = "#000";
  pixel.fillStyle = color;
  pixel.fillRect(0, 0, 1, 1);

  const { data } = pixel.getImageData(0, 0, 1, 1);
  const [r, g, b, a] = [data[0] ?? 0, data[1] ?? 0, data[2] ?? 0, data[3] ?? 255];
  return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

function flattenModernColors(root: Document): void {
  const view = root.defaultView;
  if (!view) return;

  for (const el of root.querySelectorAll<HTMLElement | SVGElement>("body, body *")) {
    const computed = view.getComputedStyle(el);

    for (const property of COLOR_PROPERTIES) {
      const value = computed.getPropertyValue(property);
      if (!value || !MODERN_COLOR.test(value)) continue;
      // `.test` on a global regex advances `lastIndex`; reset before `.replace`.
      MODERN_COLOR.lastIndex = 0;

      el.style.setProperty(property, value.replace(MODERN_COLOR, toRgb), "important");
    }
    MODERN_COLOR.lastIndex = 0;
  }
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
    onclone: (clonedDocument) => flattenModernColors(clonedDocument),
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

  // JPEG, not PNG: a lossless full-page capture at 2× came out at ~20 MB.
  pdf.addImage(
    canvas.toDataURL("image/jpeg", 0.92),
    "JPEG",
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
