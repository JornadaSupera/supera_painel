import { ErrorState, Loading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACAO_REVISAO, STATUS_CONTEUDO, type AcaoRevisao } from "@/lib/enums";
import type { ConteudoListItem } from "@/types/conteudo";
import { useComparacao } from "../hooks/useConteudos";
import { DetalheDaOrientacao } from "./DetalheDaOrientacao";

/**
 * A orientação inteira, para ler antes de decidir, ou depois de publicada.
 *
 * Abre pelo título, tanto na fila quanto na biblioteca. Ler não decide: as
 * decisões são botões à parte, e só aparecem para uma versão que está esperando
 * revisão.
 */
export function DialogDetalhe({
  conteudo,
  aberto,
  onOpenChange,
  podeDecidir,
  onDecidir,
}: {
  conteudo: ConteudoListItem | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  podeDecidir: boolean;
  onDecidir: (conteudo: ConteudoListItem, acao: AcaoRevisao) => void;
}) {
  const detalhe = useComparacao(conteudo?.id, aberto);

  if (!conteudo) return null;

  const emRevisao = conteudo.status === STATUS_CONTEUDO.EM_REVISAO;

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{conteudo.titulo}</DialogTitle>
          <DialogDescription>
            Tudo o que o paciente verá, e o histórico de decisões desta versão.
          </DialogDescription>
        </DialogHeader>

        {detalhe.isLoading && <Loading message="Carregando a orientação…" />}

        {detalhe.isError && (
          <ErrorState
            error={detalhe.error}
            title="Não foi possível carregar a orientação"
            onRetry={() => void detalhe.refetch()}
            compact
          />
        )}

        {detalhe.data && <DetalheDaOrientacao versao={detalhe.data.atual} />}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>

          {podeDecidir && emRevisao && (
            <>
              <Button variant="outline" onClick={() => onDecidir(conteudo, ACAO_REVISAO.DEVOLVER)}>
                Revisar texto
              </Button>
              <Button variant="outline" onClick={() => onDecidir(conteudo, ACAO_REVISAO.REJEITAR)}>
                Rejeitar
              </Button>
              <Button onClick={() => onDecidir(conteudo, ACAO_REVISAO.APROVAR)}>Aprovar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DialogDetalhe;
