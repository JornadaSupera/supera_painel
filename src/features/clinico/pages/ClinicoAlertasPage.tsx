import { useState } from "react";

import { EmptyState, ErrorState, PageHeader, SkeletonCards, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import {
  CONDUTA_ALERTA_LABEL,
  ESPECIALIDADE_LABEL,
  SEVERIDADE,
  SEVERIDADE_LABEL,
  STATUS_ALERTA_LABEL,
  type CondutaAlerta,
  type Severidade,
} from "@/lib/enums";
import { relativeTime } from "@/lib/format";
import type { AlertaClinico } from "@/types/clinico";
import { DialogResolverAlerta } from "../components/DialogResolverAlerta";
import { useAlertasClinicos, useAssumirAlerta, useResolverAlerta } from "../hooks/useAlertasClinicos";

/**
 * Fila de alertas — priorizada por gravidade, compartilhada pela equipe.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/farmaceutico/alertas/
 *
 * `read_alerts` não recorta por profissional: qualquer um da equipe vê a fila
 * inteira e pode assumir um item em aberto — ver PA-07. A base real está com
 * ZERO alertas hoje: nenhum gatilho de criticidade foi cadastrado em
 * Configurações (ver PA-04), então a fila fica honestamente vazia até isso
 * mudar. "Assumir" e "Resolver" exigem a permissão `alerts.triage`, concedida
 * por profissional em Usuários — sem ela, a ação volta com um erro claro em
 * vez de fingir sucesso.
 */

const ORDEM_SEVERIDADE: Severidade[] = [
  SEVERIDADE.CRITICA,
  SEVERIDADE.ALTA,
  SEVERIDADE.MEDIA,
  SEVERIDADE.BAIXA,
];

const TOM_POR_SEVERIDADE: Record<Severidade, "danger" | "warning" | "info" | "neutral"> = {
  critica: "danger",
  alta: "warning",
  media: "info",
  baixa: "neutral",
};

/** Cor da faixa esquerda dos cartões — classes reais, não um nome de variável chutado. */
const BORDA_POR_SEVERIDADE: Record<Severidade, string> = {
  critica: "border-l-danger",
  alta: "border-l-warning",
  media: "border-l-info",
  baixa: "border-l-border",
};

export function ClinicoAlertasPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const alertas = useAlertasClinicos();
  const assumir = useAssumirAlerta();
  const resolver = useResolverAlerta();

  const [emResolucao, setEmResolucao] = useState<AlertaClinico | null>(null);

  const lista = alertas.data ?? [];
  const ativos = lista
    .filter((alerta) => alerta.status !== "resolvido")
    .sort((a, b) => {
      const ordemA = ORDEM_SEVERIDADE.indexOf(a.severidade);
      const ordemB = ORDEM_SEVERIDADE.indexOf(b.severidade);
      return ordemA !== ordemB ? ordemA - ordemB : a.criado_em.localeCompare(b.criado_em);
    });
  const resolvidos = lista
    .filter((alerta) => alerta.status === "resolvido")
    .sort((a, b) => (b.resolvido_em ?? "").localeCompare(a.resolvido_em ?? ""))
    .slice(0, 10);

  const contagem = ORDEM_SEVERIDADE.map((severidade) => ({
    severidade,
    total: ativos.filter((alerta) => alerta.severidade === severidade).length,
  }));

  const vazio = !alertas.isLoading && !alertas.isError && lista.length === 0;

  function confirmarResolucao(params: { conduta: CondutaAlerta; notas: string }) {
    if (!emResolucao) return;
    resolver.mutate(
      { id: emResolucao.id, conduta: params.conduta, notas: params.notas || undefined },
      { onSuccess: () => setEmResolucao(null) },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title="Alertas"
        subtitle={`${ativos.length} ativos · ordenados por gravidade`}
      />

      {alertas.isLoading && <SkeletonCards count={3} />}

      {alertas.isError && (
        <ErrorState error={alertas.error} onRetry={() => void alertas.refetch()} />
      )}

      {vazio && (
        <EmptyState
          title="Nenhum alerta na fila"
          description="Quando um sintoma registrado atingir o grau de criticidade configurado, ele aparece aqui."
        />
      )}

      {!alertas.isLoading && !alertas.isError && lista.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {contagem.map(({ severidade, total }) => (
              <div
                key={severidade}
                className={`rounded-xl border border-l-4 p-3 ${BORDA_POR_SEVERIDADE[severidade]}`}
              >
                <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                  {SEVERIDADE_LABEL[severidade]}
                </p>
                <p className="mt-0.5 text-2xl font-semibold tabular-nums">{total}</p>
              </div>
            ))}
          </div>

          {ativos.length === 0 ? (
            <EmptyState compact title="Nenhum alerta ativo" description="Todos os alertas foram resolvidos." />
          ) : (
            <section className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Ativos</h2>

              {ativos.map((alerta) => (
                <article
                  key={alerta.id}
                  className={`bg-card flex flex-col gap-3 rounded-2xl border border-l-4 p-4 md:flex-row md:items-center md:justify-between ${BORDA_POR_SEVERIDADE[alerta.severidade]}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-foreground text-sm font-semibold">{alerta.paciente_nome}</p>
                      <StatusBadge tone={TOM_POR_SEVERIDADE[alerta.severidade]} size="sm">
                        {SEVERIDADE_LABEL[alerta.severidade]}
                      </StatusBadge>
                      <StatusBadge tone={alerta.status_tom} size="sm">
                        {STATUS_ALERTA_LABEL[alerta.status]}
                      </StatusBadge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {alerta.sintoma_label} · grau {alerta.grau} · {relativeTime(alerta.criado_em)}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {alerta.status === "pendente" && (
                      <Button
                        size="sm"
                        onClick={() => assumir.mutate(alerta.id)}
                        disabled={assumir.isPending}
                      >
                        Assumir
                      </Button>
                    )}
                    {alerta.status === "assumido" && (
                      <Button size="sm" variant="outline" onClick={() => setEmResolucao(alerta)}>
                        Resolver
                      </Button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}

          {resolvidos.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                Resolvidos recentemente
              </h2>

              {resolvidos.map((alerta) => (
                <article key={alerta.id} className="bg-card flex flex-col gap-1 rounded-2xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-foreground text-sm font-medium">{alerta.paciente_nome}</p>
                    <StatusBadge tone="success" size="sm">
                      Resolvido
                    </StatusBadge>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {alerta.sintoma_label} · grau {alerta.grau}
                    {alerta.conduta_tipo ? ` · ${CONDUTA_ALERTA_LABEL[alerta.conduta_tipo]}` : ""}
                  </p>
                  {alerta.conduta_notas && (
                    <p className="text-muted-foreground text-xs italic">{alerta.conduta_notas}</p>
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      )}

      <DialogResolverAlerta
        alerta={emResolucao}
        aberto={emResolucao !== null}
        onOpenChange={(aberto) => !aberto && setEmResolucao(null)}
        onConfirmar={confirmarResolucao}
        enviando={resolver.isPending}
      />
    </div>
  );
}

export default ClinicoAlertasPage;
