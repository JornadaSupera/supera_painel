import simbolo from "@/assets/images/logo-supera-simbolo.png";
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
 * > [!] São dois arquivos, e o segundo foi recortado do primeiro.
 * `logo-supera.png` é o lettering horizontal (720×209) e resolve todo lugar
 * que tem largura. Onde não tem — a barra lateral recolhida, com cerca de
 * 44 px úteis — ele sairia com 13 px de altura e ninguém leria.
 *
 * O material da marca não traz uma versão quadrada, então `logo-supera-simbolo.png`
 * é o "s" extraído do próprio lettering, pelo corte medido onde a letra encosta
 * no "u". É o mais perto da marca que dá para chegar sem desenhar letra nova —
 * e continua valendo pedir o símbolo oficial, que substituiria este arquivo sem
 * tocar em nenhuma tela.
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
      <img
        src={simbolo}
        alt="Supera Oncologia"
        className={cn(
          "size-8 shrink-0 select-none object-contain",
          surface === "escura" ? "brightness-125" : "dark:brightness-125",
          className,
        )}
      />
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
