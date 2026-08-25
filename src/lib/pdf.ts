/**
 * Exportação de tela para PDF e PNG.
 *
 * O MVP §5 pede "exportação de captura do dashboard"; os 12 relatórios da
 * Fase 8 exportam PDF. Ambos usam `html2canvas` + `jsPDF`, conforme o Anexo I.
 *
 * As duas bibliotecas somam bastante peso e não são usadas na maioria das
 * telas, por isso entram por `import()` dinâmico — ficam no chunk `export`,
 * carregado só quando alguém de fato exporta.
 *
 * > [!] Exportar é levar dado clínico para fora do painel.
 * Todo uso passa por permissão e gera registro na trilha de auditoria. Quem
 * chama é responsável por isso — ver `lib/audit.ts`.
 */

export interface OpcoesExportacao {
  /** Elemento a capturar. */
  elemento: HTMLElement;
  /** Nome do arquivo, sem extensão. */
  nome: string;
  /** Texto do rodapé — costuma trazer quem exportou e quando. */
  rodape?: string;
  orientacao?: "retrato" | "paisagem";
}

/**
 * Captura o elemento respeitando o tema atual.
 *
 * `html2canvas` não herda o fundo do `<body>`: sem `backgroundColor`, um
 * dashboard em tema escuro sai com texto claro sobre transparência, ou seja,
 * ilegível ao ser aberto.
 */
async function capturar(elemento: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");

  const estilo = getComputedStyle(document.body);

  return html2canvas(elemento, {
    // 2× mantém o texto nítido no PDF; acima disso o arquivo cresce sem ganho.
    scale: 2,
    backgroundColor: estilo.backgroundColor || "#ffffff",
    useCORS: true,
    logging: false,
    // Elementos marcados como `.no-print` ficam de fora — botões de ação,
    // por exemplo, não fazem sentido numa captura estática.
    ignoreElements: (el) => el.classList?.contains("no-print") ?? false,
  });
}

function baixar(blobUrl: string, nomeArquivo: string): void {
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Data e hora para compor o nome do arquivo: `2026-05-15_1432`. */
export function carimboDeTempo(): string {
  const agora = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}` +
    `_${pad(agora.getHours())}${pad(agora.getMinutes())}`
  );
}

/** Exporta o elemento como PNG. */
export async function exportarPng({ elemento, nome }: OpcoesExportacao): Promise<void> {
  const canvas = await capturar(elemento);
  baixar(canvas.toDataURL("image/png"), `${nome}.png`);
}

/**
 * Exporta o elemento como PDF de uma página, ajustado à largura.
 *
 * Captura longa é reduzida para caber na altura da folha em vez de ser cortada:
 * um dashboard partido ao meio perde justamente a comparação entre indicadores.
 */
export async function exportarPdf({
  elemento,
  nome,
  rodape,
  orientacao = "paisagem",
}: OpcoesExportacao): Promise<void> {
  const [{ default: jsPDF }, canvas] = await Promise.all([
    import("jspdf"),
    capturar(elemento),
  ]);

  const pdf = new jsPDF({
    orientation: orientacao === "paisagem" ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  const larguraPagina = pdf.internal.pageSize.getWidth();
  const alturaPagina = pdf.internal.pageSize.getHeight();

  const margem = 24;
  const alturaRodape = rodape ? 28 : 0;

  const larguraUtil = larguraPagina - margem * 2;
  const alturaUtil = alturaPagina - margem * 2 - alturaRodape;

  // Escala pela dimensão mais restritiva, preservando a proporção.
  const escala = Math.min(larguraUtil / canvas.width, alturaUtil / canvas.height);
  const largura = canvas.width * escala;
  const altura = canvas.height * escala;

  pdf.addImage(
    canvas.toDataURL("image/png"),
    "PNG",
    margem + (larguraUtil - largura) / 2,
    margem,
    largura,
    altura,
  );

  if (rodape) {
    pdf.setFontSize(8);
    pdf.setTextColor(120);
    pdf.text(rodape, margem, alturaPagina - margem / 2);
  }

  pdf.save(`${nome}.pdf`);
}
