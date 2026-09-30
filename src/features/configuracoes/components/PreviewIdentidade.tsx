/**
 * Miniatura da tela que o aplicativo do paciente mostra antes do login, com o
 * logo e as cores que estão no formulário — ainda sem salvar.
 *
 * Só apresentação: recebe os valores e desenha. Nada é gravado para pré-visualizar,
 * e o desenho é uma aproximação, não uma cópia do aplicativo; o que vale é o
 * aplicativo. As cores vão em `style` porque são valor digitado na hora, que
 * nenhuma classe do Tailwind conhece.
 */

/** Branco ou quase preto, o que for legível sobre a cor de fundo. */
function textoLegivelSobre(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  // Luminância relativa, aproximada o bastante para escolher entre dois extremos.
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? "#1a1a1a" : "#ffffff";
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
            style={{ backgroundColor: corPrimaria, color: textoLegivelSobre(corPrimaria) }}
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
