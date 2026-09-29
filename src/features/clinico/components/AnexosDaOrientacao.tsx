import { FileText, ImageOff, LoaderCircle, Paperclip, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ATTACHMENT_ACCEPT, formatFileSize, isImageAttachment } from "@/lib/attachments";
import type { AnexoConteudo } from "@/types/conteudo";
import {
  useAnexarArquivo,
  useAnexoConteudoUrl,
  useRemoverAnexo,
} from "../hooks/useOrientacoes";

/**
 * Os arquivos anexados à versão: imagem ou PDF.
 *
 * Só se anexa e se remove em rascunho — o banco impõe, e a tela acompanha
 * escondendo os botões. Uma orientação do tipo PDF precisa do arquivo antes de ir
 * para revisão, e é aqui que ele entra.
 */
export function AnexosDaOrientacao({
  versaoId,
  anexos,
  editavel,
}: {
  versaoId: string;
  anexos: AnexoConteudo[];
  editavel: boolean;
}) {
  const anexar = useAnexarArquivo(versaoId);
  const remover = useRemoverAnexo(versaoId);
  const seletorRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3">
      {anexos.length === 0 ? (
        <p className="text-muted-foreground text-xs">Nenhum arquivo anexado.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {anexos.map((anexo) => (
            <li key={anexo.id} className="bg-card flex items-center gap-3 rounded-xl border p-2.5">
              <Previa anexo={anexo} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{anexo.nome}</p>
                <p className="text-muted-foreground text-xs">{formatFileSize(anexo.tamanho)}</p>
              </div>

              {editavel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remover ${anexo.nome}`}
                  disabled={remover.isPending}
                  onClick={() => remover.mutate(anexo)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editavel && (
        <>
          <input
            ref={seletorRef}
            type="file"
            accept={ATTACHMENT_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0];
              evento.target.value = "";
              if (arquivo) anexar.mutate(arquivo);
            }}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={anexar.isPending}
              onClick={() => seletorRef.current?.click()}
            >
              {anexar.isPending ? <LoaderCircle className="animate-spin" /> : <Paperclip />}
              Anexar arquivo
            </Button>

            <span className="text-muted-foreground text-xs">
              PNG, JPEG, WebP ou PDF, até 20 MB cada.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/** Miniatura da imagem; para PDF, o botão que baixa o arquivo. */
function Previa({ anexo }: { anexo: AnexoConteudo }) {
  return isImageAttachment(anexo.mime_type) ? <MiniaturaDaImagem anexo={anexo} /> : <BaixarPdf anexo={anexo} />;
}

function MiniaturaDaImagem({ anexo }: { anexo: AnexoConteudo }) {
  const { url, isLoading, isError } = useAnexoConteudoUrl(anexo.caminho);
  const [quebrada, setQuebrada] = useState(false);

  if (isLoading) {
    return (
      <span className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-lg" role="status" aria-label="Carregando">
        <LoaderCircle className="text-muted-foreground size-4 animate-spin" aria-hidden />
      </span>
    );
  }

  if (isError || !url || quebrada) {
    return (
      <span className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-lg" title="Anexo indisponível">
        <ImageOff className="size-4" aria-label="Anexo indisponível" />
      </span>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" aria-label={`Abrir ${anexo.nome}`} className="shrink-0">
      <img
        src={url}
        alt={anexo.nome}
        onError={() => setQuebrada(true)}
        className="size-12 rounded-lg border object-cover"
      />
    </a>
  );
}

function BaixarPdf({ anexo }: { anexo: AnexoConteudo }) {
  const [pedido, setPedido] = useState(false);
  const { url, isLoading, isError } = useAnexoConteudoUrl(anexo.caminho, pedido);

  // O arquivo só existe na memória depois do download: quando chega, entrega.
  useEffect(() => {
    if (!pedido || !url) return;

    const link = document.createElement("a");
    link.href = url;
    link.download = anexo.nome;
    link.click();
    setPedido(false);
  }, [pedido, url, anexo.nome]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-12 shrink-0"
      aria-label={`Baixar ${anexo.nome}`}
      title={isError && pedido ? "Anexo indisponível" : "Baixar"}
      disabled={isLoading}
      onClick={() => setPedido(true)}
    >
      {isLoading ? <LoaderCircle className="animate-spin" /> : isError && pedido ? <ImageOff /> : <FileText />}
    </Button>
  );
}

export default AnexosDaOrientacao;
