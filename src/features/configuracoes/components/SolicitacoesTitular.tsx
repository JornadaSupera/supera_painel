import { useState } from "react";

import { Scale } from "lucide-react";

import { ConfirmDialog, EmptyState, ErrorState, SkeletonCards, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import type { SolicitacaoTitular } from "@/types/configuracao";
import { useDecidirSolicitacao, useSolicitacoesTitular } from "../hooks/useConfiguracoes";

/**
 * Os pedidos que o titular abriu sobre os próprios dados.
 *
 * > [!] Esta fila existia antes desta tela, e ninguém a via.
 * O paciente abre o pedido pelo aplicativo — acesso, correção, portabilidade,
 * revogação de consentimento, exclusão — e o painel não tinha onde mostrá-lo.
 * Um pedido aberto e sem resposta **corre prazo legal**; não era uma pendência
 * de sistema, era descumprimento com data.
 *
 * > [!] Decidir não é cumprir, e a tela não deixa isso implícito.
 * O backend aceita deferir e recusar. "Cumprido" existe na estrutura e nenhuma
 * função o alcança — então é justamente a prova do **atendimento**, que é o que
 * a LGPD cobra, que o painel não consegue registrar. Dar o pedido por encerrado
 * no deferimento seria o erro exato que essa lacuna produz.
 */

/** Prazo usual de resposta ao titular. Serve para ordenar atenção, não para decidir. */
const PRAZO_DIAS = 15;

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function Linha({
  solicitacao,
  onDecidir,
}: {
  solicitacao: SolicitacaoTitular;
  onDecidir: (deferir: boolean) => void;
}) {
  const dias = diasDesde(solicitacao.criado_em);
  const vencido = solicitacao.aberto && dias > PRAZO_DIAS;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground text-xs font-medium">{solicitacao.tipo_label}</p>

          <StatusBadge
            tone={solicitacao.aberto ? (vencido ? "danger" : "warning") : "neutral"}
            size="sm"
            dot={solicitacao.aberto}
          >
            {solicitacao.status_label}
          </StatusBadge>
        </div>

        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{solicitacao.pessoa}</p>

        <p className="text-muted-foreground text-[11px]">
          aberto {relativeTime(solicitacao.criado_em)} · {formatDate(solicitacao.criado_em)}
          {vencido && ` · ${dias} dias em aberto`}
        </p>

        {solicitacao.decidido_em && (
          <p className="text-muted-foreground mt-1 text-[11px]">
            decidido em {formatDateTime(solicitacao.decidido_em)}
            {solicitacao.decidido_por && ` · por ${solicitacao.decidido_por}`}
            {solicitacao.observacao && ` — “${solicitacao.observacao}”`}
          </p>
        )}
      </div>

      {solicitacao.aberto && (
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDecidir(false)}
            className="text-destructive hover:text-destructive"
          >
            Recusar
          </Button>

          <Button size="sm" onClick={() => onDecidir(true)}>
            Deferir
          </Button>
        </div>
      )}
    </li>
  );
}

export function SolicitacoesTitular() {
  const { solicitacoes, isLoading, isError, error, refetch } = useSolicitacoesTitular();
  const decidir = useDecidirSolicitacao();

  // O pedido em decisão, e qual decisão. `null` = nenhum diálogo aberto.
  const [decisao, setDecisao] = useState<{ pedido: SolicitacaoTitular; deferir: boolean } | null>(
    null,
  );

  if (isLoading) return <SkeletonCards count={1} />;

  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const abertos = solicitacoes.filter((solicitacao) => solicitacao.aberto).length;

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card rounded-2xl border p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-sm font-semibold">Pedidos do titular</h2>
            <p className="text-muted-foreground text-xs">
              Acesso, correção, portabilidade, revogação de consentimento e exclusão
            </p>
          </div>

          <StatusBadge
            tone={abertos > 0 ? "warning" : "success"}
            size="sm"
            dot={abertos > 0}
            className="shrink-0"
          >
            <Scale size={10} aria-hidden="true" className="mr-1" />
            {abertos} em aberto
          </StatusBadge>
        </header>

        {solicitacoes.length === 0 ? (
          <EmptyState
            compact
            title="Nenhum pedido registrado"
            description="Ninguém pediu acesso, correção ou exclusão dos próprios dados até agora."
          />
        ) : (
          <ul className="divide-border divide-y">
            {solicitacoes.map((solicitacao) => (
              <Linha
                key={solicitacao.id}
                solicitacao={solicitacao}
                onDecidir={(deferir) => setDecisao({ pedido: solicitacao, deferir })}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Deferir registra a decisão, não o cumprimento: exportar, corrigir ou excluir o dado acontece
        fora do painel, e o backend ainda não tem onde registrar que foi feito. Para a lei o que
        conta é o atendimento — mantenha o comprovante fora daqui até essa etapa existir.
      </p>

      <ConfirmDialog
        open={decisao !== null}
        onOpenChange={(aberto) => !aberto && setDecisao(null)}
        tone={decisao?.deferir ? "warning" : "danger"}
        title={decisao?.deferir ? "Deferir o pedido?" : "Recusar o pedido?"}
        description={
          decisao
            ? `${decisao.pedido.tipo_label}, aberto por ${decisao.pedido.pessoa}. A justificativa fica registrada junto da decisão e é o que responde por ela depois.`
            : undefined
        }
        confirmLabel={decisao?.deferir ? "Deferir" : "Recusar"}
        loading={decidir.isPending}
        onConfirm={({ reason }) => {
          if (decisao) {
            decidir.mutate({
              id: decisao.pedido.id,
              deferir: decisao.deferir,
              observacao: reason,
            });
          }
          setDecisao(null);
        }}
      />
    </div>
  );
}

export default SolicitacoesTitular;
