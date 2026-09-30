import { useEffect, useState } from "react";

import { ErrorState, Loading, MarkdownText, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACAO_REVISAO,
  ACAO_REVISAO_LABEL,
  REVISAO_EXIGE_COMENTARIO,
  type AcaoRevisao,
} from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import type { ConteudoListItem } from "@/types/conteudo";
import { useComparacao } from "../hooks/useConteudos";
import { DetalheDaOrientacao } from "./DetalheDaOrientacao";

/**
 * Confirmação de uma decisão de revisão.
 *
 * Aprovar publica um texto de saúde para gente em tratamento; devolver e
 * rejeitar interrompem o trabalho de outra pessoa. Nos três casos a decisão
 * passa por aqui, com o texto à vista — aprovar às cegas, direto do cartão,
 * seria o caminho mais curto para publicar o que ninguém leu.
 *
 * A versão anterior aparece ao lado quando existe. A comparação é textual e
 * feita por quem revisa: a tela mostra os dois textos, não julga qual está
 * certo.
 */

export interface DialogRevisaoProps {
  conteudo: ConteudoListItem | null;
  acao: AcaoRevisao | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  onConfirmar: (comentario: string) => void;
  enviando?: boolean;
}

const INTRODUCAO: Record<AcaoRevisao, string> = {
  [ACAO_REVISAO.APROVAR]:
    "A versão vai ao ar e passa a aparecer na biblioteca dos pacientes elegíveis. A versão que estava publicada é arquivada automaticamente.",
  [ACAO_REVISAO.DEVOLVER]:
    "A versão volta para o autor com o seu comentário. Ele pode corrigir e reenviar.",
  [ACAO_REVISAO.REJEITAR]:
    "A versão é encerrada e não segue no fluxo. O motivo fica registrado no histórico.",
  [ACAO_REVISAO.DESPUBLICAR]:
    "A orientação sai do ar e deixa de aparecer para os pacientes. O texto continua no histórico.",
};

/**
 * What the reviewer is asked to write. Returning a version and rejecting it both
 * require a comment, but they answer different questions: the first says what to
 * change, the second why the text will not go ahead.
 */
const PLACEHOLDER_COMENTARIO: Record<AcaoRevisao, string> = {
  [ACAO_REVISAO.APROVAR]: "Registre uma observação, se houver.",
  [ACAO_REVISAO.DEVOLVER]: "O que precisa mudar para esta versão ser aprovada?",
  [ACAO_REVISAO.REJEITAR]: "Explique por que esta versão não vai seguir.",
  [ACAO_REVISAO.DESPUBLICAR]: "Registre uma observação, se houver.",
};

export function DialogRevisao({
  conteudo,
  acao,
  aberto,
  onOpenChange,
  onConfirmar,
  enviando,
}: DialogRevisaoProps) {
  const [comentario, setComentario] = useState("");
  const [tocado, setTocado] = useState(false);

  const comparacao = useComparacao(conteudo?.id, aberto);

  // Cada abertura começa limpa: um comentário esquecido de uma decisão
  // anterior iria parar no histórico da versão errada.
  useEffect(() => {
    if (aberto) {
      setComentario("");
      setTocado(false);
    }
  }, [aberto, conteudo?.id]);

  if (!conteudo || !acao) return null;

  const exigeComentario = REVISAO_EXIGE_COMENTARIO.includes(acao);
  const faltaComentario = exigeComentario && comentario.trim() === "";
  const destrutiva = acao === ACAO_REVISAO.REJEITAR || acao === ACAO_REVISAO.DESPUBLICAR;

  const atual = comparacao.data?.atual;
  const anterior = comparacao.data?.anterior;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {ACAO_REVISAO_LABEL[acao]} · {conteudo.titulo}
          </DialogTitle>
          <DialogDescription>{INTRODUCAO[acao]}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {comparacao.isLoading && <Loading message="Carregando o texto…" />}

          {comparacao.isError && (
            <ErrorState
              error={comparacao.error}
              title="Não foi possível carregar o texto"
              onRetry={() => void comparacao.refetch()}
              compact
            />
          )}

          {atual && <DetalheDaOrientacao versao={atual} />}

          {atual && anterior && (
            <details className="bg-muted/40 rounded-xl border p-3">
              <summary className="cursor-pointer text-xs font-medium">
                Comparar com a versão {anterior.versao} (anterior)
              </summary>
              <div className="mt-3">
                <TextoDaVersao
                  titulo={`Versão ${anterior.versao} · anterior`}
                  corpo={anterior.corpo}
                  atualizadoEm={anterior.atualizado_em}
                />
              </div>
            </details>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="comentario-revisao">
              Comentário do revisor
              {exigeComentario ? (
                <span className="text-destructive"> *</span>
              ) : (
                <span className="text-muted-foreground font-normal"> (opcional)</span>
              )}
            </Label>

            <Textarea
              id="comentario-revisao"
              rows={3}
              value={comentario}
              onChange={(evento) => setComentario(evento.target.value)}
              onBlur={() => setTocado(true)}
              aria-invalid={tocado && faltaComentario}
              aria-describedby="ajuda-comentario-revisao"
              placeholder={PLACEHOLDER_COMENTARIO[acao]}
            />

            <p id="ajuda-comentario-revisao" className="text-muted-foreground text-[11px]">
              {tocado && faltaComentario ? (
                <span className="text-destructive">
                  {ACAO_REVISAO_LABEL[acao]} exige um comentário: sem ele o autor não sabe o que
                  corrigir.
                </span>
              ) : (
                "O comentário fica no histórico da versão, visível para o autor."
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>

          <Button
            variant={destrutiva ? "destructive" : "default"}
            disabled={enviando || faltaComentario}
            onClick={() => onConfirmar(comentario.trim())}
          >
            {enviando ? "Registrando…" : ACAO_REVISAO_LABEL[acao]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * O corpo de uma versão.
 *
 * O texto é Markdown simples, desenhado como elementos do React — nunca por
 * `dangerouslySetInnerHTML`. O corpo vem do editor de outra pessoa, e é
 * exatamente o tipo de campo que carregaria um script se a marcação fosse
 * injetada crua.
 */
function TextoDaVersao({
  titulo,
  corpo,
  atualizadoEm,
}: {
  titulo: string;
  corpo: string;
  atualizadoEm: string;
}) {
  return (
    <section className="bg-background rounded-xl border p-3">
      <header className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge tone="neutral" size="sm">
          {titulo}
        </StatusBadge>
        <time className="text-muted-foreground text-[11px] tabular-nums" dateTime={atualizadoEm}>
          {formatDateTime(atualizadoEm)}
        </time>
      </header>

      <div className="max-h-64 overflow-y-auto pr-1">
        <MarkdownText source={corpo} className="text-xs" />
      </div>
    </section>
  );
}

export default DialogRevisao;
