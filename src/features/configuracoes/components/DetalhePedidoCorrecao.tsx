import { UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiException, ERROR_CODE } from "@/services/contracts";
import { formatDate } from "@/lib/format";
import type { SolicitacaoTitular } from "@/types/configuracao";
import { useTextoSolicitacao } from "../hooks/useConfiguracoes";

/**
 * O pedido de correção por dentro: o que o paciente quer corrigir, e o caminho
 * para a ficha onde o dado se corrige.
 *
 * > [!] É o único lugar do painel em que esse texto aparece. Ele pode trazer o
 * celular ou o CPF corretos, então não vai para a lista, para notificações nem
 * para exportações. O hook que o lê não guarda cache (`gcTime: 0`) e registra o
 * acesso como leitura de dado pessoal.
 */

export interface DetalhePedidoCorrecaoProps {
  pedido: SolicitacaoTitular | null;
  onOpenChange: (open: boolean) => void;
}

const SEM_TEXTO =
  "O paciente não descreveu o que corrigir. Entre em contato para saber.";

function Texto({ pedido }: { pedido: SolicitacaoTitular }) {
  const { data, isLoading, error, refetch } = useTextoSolicitacao(pedido.id, true);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }

  if (error) {
    const naoDisponivel =
      error instanceof ApiException && error.code === ERROR_CODE.NOT_IMPLEMENTED;

    return (
      <ErrorState
        compact
        error={error}
        title={naoDisponivel ? "Ainda não disponível" : undefined}
        description={naoDisponivel ? error.message : undefined}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data?.texto) {
    return <p className="text-muted-foreground text-sm leading-relaxed">{SEM_TEXTO}</p>;
  }

  return (
    <blockquote className="bg-muted/60 border-primary rounded-lg border-l-4 p-4 text-sm leading-relaxed whitespace-pre-wrap">
      {data.texto}
    </blockquote>
  );
}

export function DetalhePedidoCorrecao({ pedido, onOpenChange }: DetalhePedidoCorrecaoProps) {
  return (
    <Dialog open={pedido !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {pedido && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                Pedido de correção
                <StatusBadge tone={pedido.aberto ? "warning" : "neutral"} size="sm">
                  {pedido.status_label}
                </StatusBadge>
              </DialogTitle>

              <DialogDescription>
                {pedido.pessoa} · aberto em {formatDate(pedido.criado_em)}
              </DialogDescription>
            </DialogHeader>

            <section className="flex flex-col gap-2" aria-label="O que o paciente quer corrigir">
              <h3 className="text-foreground text-xs font-semibold">O que o paciente quer corrigir</h3>
              <Texto pedido={pedido} />
            </section>

            <p className="text-muted-foreground text-xs leading-relaxed">
              Corrija o dado na ficha do paciente e volte aqui para marcar como cumprida. O texto
              acima só aparece nesta tela: não vai para listas, notificações nem exportações.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>

              {/* A ficha se abre pela lista de Pacientes: o banco ainda não entrega o
                  id do paciente a partir da conta do titular, então não há link direto. */}
              <Button asChild>
                <Link to="/pacientes">
                  <UserRound size={14} aria-hidden="true" />
                  Procurar a ficha de {pedido.pessoa}
                </Link>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default DetalhePedidoCorrecao;
