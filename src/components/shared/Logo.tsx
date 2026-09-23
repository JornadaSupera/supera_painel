import { Activity } from "lucide-react";

import wordmark from "@/assets/images/logo-supera.png";
import { cn } from "@/lib/utils";

/**
 * A marca da clínica.
 *
 * Existe como componente, e não como um `<img>` repetido, porque a marca
 * aparecia em cinco lugares — barra lateral, menu do celular, tela de entrada,
 * páginas públicas e documentos legais — e cada um desenhava o seu próprio
 * quadrado com um ícone de pulso do catálogo de ícones. Aquele símbolo nunca
 * foi a marca: era um marcador que ficou.
 *
 * > [!] O arquivo é um LETTERING, não um símbolo.
 * `logo-supera.png` é horizontal (720×209) e escreve "supera oncologia". Ele
 * resolve todo lugar que tem largura, e não resolve o único que não tem: a
 * barra lateral recolhida, com cerca de 44 px úteis, onde o lettering sairia
 * com 13 px de altura e ninguém leria. Lá continua um selo quadrado — e é a
 * peça que falta no material da marca, não uma escolha de tela.
 *
 * > [!] Fundo escuro não é o mesmo que tema escuro.
 * O verde-água da marca foi desenhado para fundo claro, e sobre o verde
 * institucional (`#1d4542`) o contraste fica em torno de 3:1 — fraco mesmo
 * para uma marca, que a norma dispensa do mínimo de texto. O cabeçalho dos
 * documentos legais é escuro **nos dois temas**, então quem desenha declara a
 * superfície em vez de o componente inferir pelo tema: inferir acertaria o
 * painel e erraria justamente a página que originou a queixa.
 */

export interface LogoProps {
  /**
   * `wordmark` desenha o lettering da clínica.
   * `selo` desenha o quadrado compacto, para onde não cabe o lettering.
   */
  variant?: "wordmark" | "selo";
  /** Altura do lettering, em px. A largura acompanha a proporção do arquivo. */
  height?: number;
  /**
   * A superfície por trás.
   *
   * `auto` segue o tema — claro no claro, escuro no escuro. `escura` é para
   * quem é escuro sempre, como o cabeçalho dos documentos legais.
   */
  surface?: "auto" | "escura";
  className?: string;
}

export function Logo({
  variant = "wordmark",
  height = 28,
  surface = "auto",
  className,
}: LogoProps) {
  if (variant === "selo") {
    return (
      <span
        className={cn(
          "bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg",
          className,
        )}
      >
        <Activity size={18} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={wordmark}
      /*
       * A marca é conteúdo, não decoração: quem usa leitor de tela precisa
       * saber de quem é o painel. O nome do produto vem no texto ao lado, e
       * repeti-lo aqui faria o leitor anunciar a mesma coisa duas vezes.
       */
      alt="Supera Oncologia"
      height={height}
      style={{ height }}
      className={cn(
        "w-auto shrink-0 select-none",
        surface === "escura" ? "brightness-125" : "dark:brightness-125",
        className,
      )}
    />
  );
}

export default Logo;
