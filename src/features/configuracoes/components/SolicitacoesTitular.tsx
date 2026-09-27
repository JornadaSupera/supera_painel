import { useState } from "react";

import { Scale } from "lucide-react";

import { AlertTriangle } from "lucide-react";

import { ConfirmDialog, EmptyState, ErrorState, Footnote, SkeletonCards, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import type { SolicitacaoTitular } from "@/types/configuracao";
import {
  useCompletarSolicitacao,
  useDecidirSolicitacao,
  useSolicitacoesTitular,
} from "../hooks/useConfiguracoes";

/**
 * Os pedidos que o titular abriu sobre os próprios dados.
 *
 * > [!] Esta fila existia antes desta tela, e ninguém a via.
 * O paciente abre o pedido pelo aplicativo — acesso, correção, portabilidade,
 * revogação de consentimento, exclusão — e o painel não tinha onde mostrá-lo.
 * Um pedido aberto e sem resposta **corre prazo legal**; não era uma pendência
 * de sistema, era descumprimento com data.
 *
 * > [!] Decidir não é cumprir — mas "cumprir" significa coisas diferentes por tipo.
 * Exclusão e revogação de consentimento se executam sozinhas, pela rotina
 * agendada (`execution_error` avisa aqui quando ela falha); correção pede o
 * botão "marcar como cumprida", que só aparece nela; acesso e portabilidade o
 * titular resolve sozinho, pelo app — o painel não tem o que fazer depois de
 * deferir.
 */

/** Prazo usual de resposta ao titular. Serve para ordenar atenção, não para decidir. */
const PRAZO_DIAS = 15;

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function Linha({
  solicitacao,
  onDecidir,
  onCompletar,
}: {
  solicitacao: SolicitacaoTitular;
  onDecidir: (deferir: boolean) => void;
  onCompletar: () => void;
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

        {solicitacao.execucao_erro && (
          <p className="text-destructive mt-1 flex items-start gap-1 text-[11px]">
            <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>A execução automática falhou: {solicitacao.execucao_erro}</span>
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

      {solicitacao.completavel && (
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onCompletar}>
            Marcar como cumprida
          </Button>
        </div>
      )}
    </li>
  );
}

export function SolicitacoesTitular() {
  const { solicitacoes, isLoading, isError, error, refetch } = useSolicitacoesTitular();
  const decidir = useDecidirSolicitacao();
  const completar = useCompletarSolicitacao();

  // O pedido em decisão, e qual decisão. `null` = nenhum diálogo aberto.
  const [decisao, setDecisao] = useState<{ pedido: SolicitacaoTitular; deferir: boolean } | null>(
    null,
  );

  // O pedido em vias de ser marcado como cumprido. `null` = nenhum diálogo aberto.
  const [completando, setCompletando] = useState<SolicitacaoTitular | null>(null);

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
                onCompletar={() => setCompletando(solicitacao)}
              />
            ))}
          </ul>
        )}
      </section>

      <Footnote>
        Deferir registra a decisão, não o cumprimento. Exclusão e revogação de consentimento se
        executam sozinhas, em até 5 minutos — esta tela avisa se a execução falhar. Correção pede
        o passo extra de marcar como cumprida, depois de o dado já estar corrigido fora do painel.
        Acesso e portabilidade o titular resolve sozinho, pelo app.
      </Footnote>

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

      <ConfirmDialog
        open={completando !== null}
        onOpenChange={(aberto) => !aberto && setCompletando(null)}
        tone="warning"
        title="Marcar pedido de correção como cumprido?"
        description={
          completando
            ? `Correção aberta por ${completando.pessoa}. Confirme só depois de já ter corrigido o dado fora do painel — descreva o que foi corrigido.`
            : undefined
        }
        confirmLabel="Marcar como cumprida"
        loading={completar.isPending}
        onConfirm={({ reason }) => {
          if (completando) {
            completar.mutate({ id: completando.id, observacao: reason });
          }
          setCompletando(null);
        }}
      />
    </div>
  );
}

export default SolicitacoesTitular;
