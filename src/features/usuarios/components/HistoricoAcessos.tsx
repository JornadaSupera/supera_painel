import { ErrorState, StatusBadge, TONE_AUDIT_ACTION } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ACAO_AUDITORIA_LABEL, ORIGEM_AUDITORIA_LABEL } from "@/lib/enums";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useAcessos } from "../hooks/useUsuarios";
import type { UsuarioListItem } from "@/types/usuario";

/**
 * Histórico de acessos de um profissional.
 *
 * É o recorte por pessoa da mesma trilha que a tela de Auditoria lê por
 * período. Aqui responde "o que esta pessoa andou fazendo"; lá, "quem tocou
 * neste dado".
 *
 * A consulta só dispara quando a gaveta abre — não faz sentido carregar o
 * rastro de dezoito pessoas para exibir o de uma.
 */
export function HistoricoAcessos({
  usuario,
  aberto,
  onOpenChange,
}: {
  usuario: UsuarioListItem | null;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useAcessos(usuario?.id, aberto);
  const logs = data?.data ?? [];

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de acessos</DialogTitle>
          <DialogDescription>
            {usuario?.nome} · últimos registros da trilha de auditoria
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex flex-col gap-3" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
            <span className="sr-only">Carregando histórico</span>
          </div>
        )}

        {isError && <ErrorState error={error} onRetry={() => void refetch()} compact />}

        {!isLoading && !isError && logs.length === 0 && (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nenhum acesso registrado para este profissional.
          </p>
        )}

        {logs.length > 0 && (
          <ol className="divide-border max-h-96 divide-y overflow-y-auto">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <StatusBadge tone={TONE_AUDIT_ACTION[log.acao]} size="sm">
                    {ACAO_AUDITORIA_LABEL[log.acao]}
                  </StatusBadge>

                  <div className="min-w-0">
                    <p className="truncate text-sm">{log.recurso}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {ORIGEM_AUDITORIA_LABEL[log.origem]} · {log.user_agent}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-xs tabular-nums">{relativeTime(log.criado_em)}</p>
                  <p className="text-muted-foreground font-mono text-[11px]">{log.ip}</p>
                  <p className="sr-only">{formatDateTime(log.criado_em)}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default HistoricoAcessos;
