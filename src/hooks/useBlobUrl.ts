import { useEffect, useState } from "react";

/**
 * Um arquivo em memória como URL `blob:`, e o gesto de entregá-lo ao disco.
 *
 * O navegador só carrega imagem de `blob:` (a política de conteúdo do painel não
 * libera o domínio do armazenamento), então o arquivo é baixado e exibido a partir
 * da memória. Nada é gravado no navegador.
 */

/**
 * A URL nasce e morre no MESMO efeito. Criá-la durante a renderização e revogá-la
 * no cleanup quebra com o dado já em cache: o React remonta o efeito (sempre em
 * desenvolvimento) e reaproveita a URL que o primeiro cleanup acabou de revogar, e
 * a imagem fica quebrada.
 */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const criada = URL.createObjectURL(blob);
    setUrl(criada);
    return () => URL.revokeObjectURL(criada);
  }, [blob]);

  return url;
}

/**
 * Entrega o arquivo assim que ele chega, se alguém pediu.
 *
 * O arquivo só existe na memória depois do download; quem clica em "Baixar" pede,
 * e este efeito o salva quando a URL fica pronta e desfaz o pedido.
 */
export function useSaveWhenReady(
  { url, pedido, nome }: { url: string | null; pedido: boolean; nome: string },
  aoEntregar: () => void,
): void {
  useEffect(() => {
    if (!pedido || !url) return;

    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    link.click();
    aoEntregar();
    // `aoEntregar` é o setter do pedido: trocá-lo não deve reentregar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, url, nome]);
}
