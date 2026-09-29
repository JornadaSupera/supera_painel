import { Download, FileText, ImageOff, LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { formatFileSize, isImageAttachment } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import type { AnexoMensagem } from "@/types/clinico";
import { useAnexoUrl } from "../hooks/useConversasClinicas";

/**
 * Um anexo dentro da conversa.
 *
 * Imagem aparece como miniatura e abre inteira ao clicar. PDF só é baixado
 * quando a pessoa pede: uma conversa com vários PDFs não deve baixar todos só
 * por ter sido aberta.
 */
export function AnexoDaMensagem({ anexo, daEquipe }: { anexo: AnexoMensagem; daEquipe: boolean }) {
  return isImageAttachment(anexo.mime_type) ? (
    <AnexoImagem anexo={anexo} />
  ) : (
    <AnexoArquivo anexo={anexo} daEquipe={daEquipe} />
  );
}

function AnexoImagem({ anexo }: { anexo: AnexoMensagem }) {
  const { url, isLoading, isError } = useAnexoUrl(anexo.caminho);

  if (isLoading) {
    return (
      <div
        className="bg-muted flex h-24 w-40 items-center justify-center rounded-xl"
        role="status"
        aria-label={`Carregando ${anexo.nome}`}
      >
        <LoaderCircle className="text-muted-foreground size-4 animate-spin" aria-hidden />
      </div>
    );
  }

  if (isError || !url) return <AnexoIndisponivel nome={anexo.nome} />;

  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label={`Abrir ${anexo.nome}`}>
      <img
        src={url}
        alt={anexo.nome}
        className="max-h-48 max-w-full rounded-xl border object-cover"
      />
    </a>
  );
}

function AnexoArquivo({ anexo, daEquipe }: { anexo: AnexoMensagem; daEquipe: boolean }) {
  const [pedido, setPedido] = useState(false);
  const { url, isLoading, isError } = useAnexoUrl(anexo.caminho, pedido);

  // O arquivo só existe na memória depois do download: quando chega, entrega.
  useEffect(() => {
    if (!pedido || !url) return;

    const link = document.createElement("a");
    link.href = url;
    link.download = anexo.nome;
    link.click();
    setPedido(false);
  }, [pedido, url, anexo.nome]);

  if (isError && pedido) return <AnexoIndisponivel nome={anexo.nome} />;

  return (
    <button
      type="button"
      onClick={() => setPedido(true)}
      disabled={isLoading}
      className={cn(
        "flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs transition-colors",
        daEquipe
          ? "border-primary-foreground/30 hover:bg-primary-foreground/10"
          : "bg-background hover:bg-muted",
      )}
    >
      <FileText className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{anexo.nome}</span>
      <span className="shrink-0 opacity-70">{formatFileSize(anexo.tamanho)}</span>
      {isLoading ? (
        <LoaderCircle className="size-3.5 shrink-0 animate-spin" aria-hidden />
      ) : (
        <Download className="size-3.5 shrink-0" aria-hidden />
      )}
      <span className="sr-only">Baixar</span>
    </button>
  );
}

function AnexoIndisponivel({ nome }: { nome: string }) {
  return (
    <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
      <ImageOff className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{nome} — anexo indisponível</span>
    </div>
  );
}

export default AnexoDaMensagem;
