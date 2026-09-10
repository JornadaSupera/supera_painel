import { useEffect, useState } from "react";

import { ErrorState, Loading, StatusBadge } from "@/components/shared";
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

          {atual && (
            <div className="grid gap-4 md:grid-cols-2">
              <TextoDaVersao
                titulo={`Versão ${atual.versao} · em revisão`}
                corpo={atual.corpo}
                atualizadoEm={atual.atualizado_em}
                destaque
              />

              {anterior ? (
                <TextoDaVersao
                  titulo={`Versão ${anterior.versao} · anterior`}
                  corpo={anterior.corpo}
                  atualizadoEm={anterior.atualizado_em}
                />
              ) : (
                <div className="border-border/70 text-muted-foreground flex items-center justify-center rounded-xl border border-dashed p-4 text-center text-xs">
                  Primeira versão desta orientação — não há texto anterior para comparar.
                </div>
              )}
            </div>
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
              placeholder={
                exigeComentario
                  ? "O que precisa mudar para esta versão ser aprovada?"
                  : "Registre uma observação, se houver."
              }
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
 * O texto é renderizado como parágrafos — nunca por `dangerouslySetInnerHTML`.
 * O corpo vem do editor de outra pessoa, e é exatamente o tipo de campo que
 * carregaria um script se a marcação fosse injetada crua.
 */
function TextoDaVersao({
  titulo,
  corpo,
  atualizadoEm,
  destaque,
}: {
  titulo: string;
  corpo: string;
  atualizadoEm: string;
  destaque?: boolean;
}) {
  const paragrafos = corpo.split(/\n{2,}/).filter((trecho) => trecho.trim() !== "");

  return (
    <section
      className={
        destaque
          ? "border-primary/30 bg-primary/5 rounded-xl border p-3"
          : "bg-muted/40 rounded-xl border p-3"
      }
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <StatusBadge tone={destaque ? "primary" : "neutral"} size="sm">
          {titulo}
        </StatusBadge>
        <time className="text-muted-foreground text-[10px] tabular-nums" dateTime={atualizadoEm}>
          {formatDateTime(atualizadoEm)}
        </time>
      </header>

      <div className="max-h-64 overflow-y-auto pr-1">
        {paragrafos.map((paragrafo, indice) => (
          <p
            // O texto não tem id próprio; a posição é o que distingue um
            // parágrafo do outro dentro da mesma versão imutável.
            key={`${titulo}-${indice}`}
            className="text-foreground mb-2 text-xs leading-relaxed whitespace-pre-line last:mb-0"
          >
            {paragrafo}
          </p>
        ))}
      </div>
    </section>
  );
}

export default DialogRevisao;
