import { ExternalLink, FileText, ImageOff, LoaderCircle, Video } from "lucide-react";
import { useState } from "react";

import { DecisionList, MarkdownText, StatusBadge, TONE_CONTENT_STATUS } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useSaveWhenReady } from "@/hooks/useBlobUrl";
import { useContentAttachmentUrl } from "@/hooks/useContentAttachmentUrl";
import { formatFileSize, isImageAttachment } from "@/lib/attachments";
import {
  ACAO_REVISAO_LABEL,
  STATUS_CONTEUDO_LABEL,
  TIPO_CONTEUDO_LABEL,
} from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import type { AnexoConteudo, ConteudoDetalhe } from "@/types/conteudo";

/**
 * Uma versão de orientação inteira, como o revisor precisa ler: o que ela é, o
 * texto, o vídeo, as imagens e os PDFs, a quem se destina e o que já foi decidido
 * sobre ela.
 *
 * Aprovar uma orientação publica material de saúde para gente em tratamento; quem
 * decide vê tudo o que o paciente verá, e não só o texto.
 *
 * O vídeo abre no site de origem: a política de conteúdo do painel não permite
 * quadros de outro domínio, então não há player embutido. As imagens vêm do
 * armazenamento e aparecem por URL `blob:`.
 */
export function DetalheDaOrientacao({ versao }: { versao: ConteudoDetalhe }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <StatusBadge tone={TONE_CONTENT_STATUS[versao.status]} size="sm" dot>
          {STATUS_CONTEUDO_LABEL[versao.status]}
        </StatusBadge>
        <span className="text-muted-foreground text-xs">
          {TIPO_CONTEUDO_LABEL[versao.tipo]} · {versao.categoria} · versão {versao.versao}
          {versao.minutos_leitura ? ` · ${versao.minutos_leitura} min de leitura` : ""}
        </span>
      </div>

      <p className="text-muted-foreground text-xs">
        Por <span className="text-foreground font-medium">{versao.autor_nome}</span> · atualizada em{" "}
        <time dateTime={versao.atualizado_em}>{formatDateTime(versao.atualizado_em)}</time>
      </p>

      <section className="bg-card rounded-xl border p-4" aria-label="Texto da orientação">
        <MarkdownText source={versao.corpo} />
      </section>

      {versao.video_url && (
        <section aria-labelledby="detalhe-video" className="flex flex-col gap-1.5">
          <h3 id="detalhe-video" className="flex items-center gap-1.5 text-xs font-semibold">
            <Video size={13} aria-hidden="true" />
            Vídeo
          </h3>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <a href={versao.video_url} target="_blank" rel="noreferrer noopener">
              Assistir no site de origem
              <ExternalLink />
            </a>
          </Button>
          <p className="text-muted-foreground font-mono text-[11px] break-all">{versao.video_url}</p>
        </section>
      )}

      {versao.anexos.length > 0 && (
        <section aria-labelledby="detalhe-anexos" className="flex flex-col gap-2">
          <h3 id="detalhe-anexos" className="text-xs font-semibold">
            Imagens e arquivos ({versao.anexos.length})
          </h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {versao.anexos.map((anexo) => (
              <li key={anexo.id}>
                <Anexo anexo={anexo} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="detalhe-cids" className="flex flex-col gap-1.5">
        <h3 id="detalhe-cids" className="text-xs font-semibold">
          A quem se destina
        </h3>
        {versao.cids.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            Todos os pacientes: a orientação não tem marcação de CID.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {versao.cids.map((cid) => (
              <li key={cid.code}>
                <StatusBadge tone="neutral" size="sm">
                  {cid.code} · {cid.label}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      {versao.revisoes.length > 0 && (
        <section aria-labelledby="detalhe-decisoes" className="flex flex-col gap-2">
          <h3 id="detalhe-decisoes" className="text-xs font-semibold">
            Decisões já tomadas
          </h3>
          <DecisionList
            decisions={versao.revisoes.map((revisao) => ({
              id: revisao.id,
              title: `${ACAO_REVISAO_LABEL[revisao.acao]} · ${revisao.revisor_nome}`,
              at: revisao.criado_em,
              comment: revisao.comentario,
            }))}
          />
        </section>
      )}
    </div>
  );
}

/** Uma imagem aparece aberta; um PDF, como um arquivo que se baixa. */
function Anexo({ anexo }: { anexo: AnexoConteudo }) {
  return isImageAttachment(anexo.mime_type) ? <Imagem anexo={anexo} /> : <Pdf anexo={anexo} />;
}

function Imagem({ anexo }: { anexo: AnexoConteudo }) {
  const { url, isLoading, isError } = useContentAttachmentUrl(anexo.caminho);
  const [quebrada, setQuebrada] = useState(false);

  return (
    <figure className="bg-muted/40 flex flex-col gap-1.5 rounded-xl border p-2">
      <div className="bg-muted flex min-h-32 items-center justify-center overflow-hidden rounded-lg">
        {isLoading && (
          <span role="status" aria-label="Carregando a imagem">
            <LoaderCircle className="text-muted-foreground animate-spin" aria-hidden="true" />
          </span>
        )}

        {(isError || quebrada) && (
          <span className="text-muted-foreground flex items-center gap-1.5 p-4 text-xs">
            <ImageOff size={14} aria-hidden="true" />
            Imagem indisponível
          </span>
        )}

        {url && !quebrada && (
          <a href={url} target="_blank" rel="noreferrer" aria-label={`Abrir ${anexo.nome} em tamanho real`}>
            <img
              src={url}
              alt={anexo.nome}
              onError={() => setQuebrada(true)}
              className="max-h-64 w-full object-contain"
            />
          </a>
        )}
      </div>
      <figcaption className="text-muted-foreground truncate text-[11px]">
        {anexo.nome} · {formatFileSize(anexo.tamanho)}
      </figcaption>
    </figure>
  );
}

function Pdf({ anexo }: { anexo: AnexoConteudo }) {
  const [pedido, setPedido] = useState(false);
  const { url, isLoading, isError } = useContentAttachmentUrl(anexo.caminho, pedido);

  useSaveWhenReady({ url, pedido, nome: anexo.nome }, () => setPedido(false));

  return (
    <div className="bg-muted/40 flex items-center gap-3 rounded-xl border p-3">
      <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
        <FileText size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{anexo.nome}</p>
        <p className="text-muted-foreground text-[11px]">PDF · {formatFileSize(anexo.tamanho)}</p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={() => setPedido(true)}
        title={isError && pedido ? "Arquivo indisponível" : undefined}
      >
        {isLoading ? <LoaderCircle className="animate-spin" /> : null}
        {isError && pedido ? "Indisponível" : "Baixar"}
      </Button>
    </div>
  );
}

export default DetalheDaOrientacao;
