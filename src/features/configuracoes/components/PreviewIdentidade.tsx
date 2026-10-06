/**
 * Miniatura da tela que o aplicativo do paciente mostra antes do login, com o
 * logo e as cores que estão no formulário — ainda sem salvar.
 *
 * Só apresentação: recebe os valores e desenha. Nada é gravado para pré-visualizar,
 * e o desenho é uma aproximação, não uma cópia do aplicativo; o que vale é o
 * aplicativo. As cores vão em `style` porque são valor digitado na hora, que
 * nenhuma classe do Tailwind conhece.
 */

// The two candidates for text on the typed colour. The dark one is the app's
// text on its brand green — the clinic's rule is never white on that green.
const DARK_TEXT = "#12332f";
const LIGHT_TEXT = "#ffffff";

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const linear = (start: number) => {
    const channel = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

/**
 * Whichever of the two reads better on the background, by WCAG contrast ratio.
 * A brightness threshold picked white for mid greens like #33baab (2.4:1),
 * where the dark text reaches 5.7:1.
 */
function readableTextOn(hex: string): string {
  const background = luminance(hex);
  const onDark = (luminance(LIGHT_TEXT) + 0.05) / (background + 0.05);
  const onLight = (background + 0.05) / (luminance(DARK_TEXT) + 0.05);
  return onLight >= onDark ? DARK_TEXT : LIGHT_TEXT;
}

export function PreviewIdentidade({
  corPrimaria,
  corSecundaria,
  logoUrl,
}: {
  corPrimaria: string;
  corSecundaria: string;
  logoUrl: string | null;
}) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div
        role="img"
        aria-label="Pré-visualização da tela de entrada do aplicativo com o logo e as cores escolhidas"
        className="border-border bg-background flex w-44 flex-col overflow-hidden rounded-[1.6rem] border-2 shadow-sm"
      >
        <div
          className="flex h-24 items-center justify-center"
          style={{ backgroundColor: corPrimaria }}
        >
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-white/90">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" />
            ) : (
              <span className="text-[9px] text-neutral-500">Sem logo</span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 px-4 py-4">
          <div className="flex flex-col gap-1">
            <span className="bg-muted h-2 w-16 rounded" />
            <span className="border-border h-6 rounded-md border" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="bg-muted h-2 w-10 rounded" />
            <span className="border-border h-6 rounded-md border" />
          </div>

          <span
            className="flex h-7 items-center justify-center rounded-md text-[10px] font-semibold"
            style={{ backgroundColor: corPrimaria, color: readableTextOn(corPrimaria) }}
          >
            Entrar
          </span>

          <span
            className="text-center text-[10px] font-medium underline"
            style={{ color: corSecundaria }}
          >
            Esqueci minha senha
          </span>
        </div>
      </div>

      <figcaption className="text-muted-foreground max-w-44 text-center text-[11px] leading-relaxed">
        Aproximação da tela de entrada. O aplicativo é o que vale.
      </figcaption>
    </figure>
  );
}

export default PreviewIdentidade;
