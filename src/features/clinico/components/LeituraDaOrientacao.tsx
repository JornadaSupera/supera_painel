import { MarkdownText, StatusBadge, TONE_CONTENT_STATUS } from "@/components/shared";
import { ACAO_REVISAO_LABEL, STATUS_CONTEUDO_LABEL, TIPO_CONTEUDO_LABEL } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import type { ConteudoDetalhe } from "@/types/conteudo";
import { AnexosDaOrientacao } from "./AnexosDaOrientacao";

/**
 * Uma orientação que já não se edita: em revisão, publicada, rejeitada ou
 * despublicada.
 *
 * O texto continua à vista — o autor precisa reler o que foi para o revisor —, e
 * o histórico de decisões diz por que a versão está onde está. Para mudar uma
 * orientação publicada, o caminho é uma nova versão, que não é desta tela.
 */
export function LeituraDaOrientacao({ orientacao }: { orientacao: ConteudoDetalhe }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={TONE_CONTENT_STATUS[orientacao.status]} dot>
          {STATUS_CONTEUDO_LABEL[orientacao.status]}
        </StatusBadge>
        <span className="text-muted-foreground text-xs">
          {TIPO_CONTEUDO_LABEL[orientacao.tipo]} · {orientacao.categoria} · versão {orientacao.versao} ·
          atualizada em {formatDateTime(orientacao.atualizado_em)}
        </span>
      </div>

      <p className="text-muted-foreground bg-muted/40 rounded-lg border p-3 text-xs">
        Esta versão não pode mais ser editada: o texto que foi para a revisão é o que o revisor
        decide.
      </p>

      <section className="bg-card rounded-2xl border p-5">
        <MarkdownText source={orientacao.corpo} />
      </section>

      {orientacao.video_url && (
        <p className="text-sm">
          Vídeo: <span className="font-mono text-xs break-all">{orientacao.video_url}</span>
        </p>
      )}

      {orientacao.cids.length > 0 && (
        <p className="text-muted-foreground text-xs">
          CID-10: {orientacao.cids.map((cid) => cid.code).join(", ")}
        </p>
      )}

      {orientacao.anexos.length > 0 && (
        <section aria-labelledby="anexos-leitura" className="flex flex-col gap-2">
          <h2 id="anexos-leitura" className="text-sm font-medium">
            Arquivos anexos
          </h2>
          <AnexosDaOrientacao versaoId={orientacao.id} anexos={orientacao.anexos} editavel={false} />
        </section>
      )}

      {orientacao.revisoes.length > 0 && (
        <section aria-labelledby="decisoes" className="flex flex-col gap-2">
          <h2 id="decisoes" className="text-sm font-medium">
            Decisões do revisor
          </h2>
          <ul className="flex flex-col gap-2">
            {orientacao.revisoes.map((revisao) => (
              <li key={revisao.id} className="bg-card rounded-xl border p-3 text-sm">
                <p className="text-xs font-medium">
                  {ACAO_REVISAO_LABEL[revisao.acao]} · {revisao.revisor_nome}
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {formatDateTime(revisao.criado_em)}
                  </span>
                </p>
                {revisao.comentario && (
                  <p className="text-muted-foreground mt-1 whitespace-pre-line">{revisao.comentario}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default LeituraDaOrientacao;
