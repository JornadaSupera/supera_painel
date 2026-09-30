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
import { formatDateTime, relativeTime } from "@/lib/format";
import type { AlertaClinico } from "@/types/clinico";
import { DesignarAlertaDialog } from "../components/DesignarAlertaDialog";
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
 * mudar. "Assumir", "Designar" e "Resolver" exigem a permissão `alerts.triage`,
 * concedida por profissional em Usuários — sem ela, a ação volta com um erro
 * claro em vez de fingir sucesso.
 *
 * > [!] A fila e o histórico são leituras separadas, por estado
 * `read_alerts` entrega os mais ANTIGOS primeiro, até 200. Numa leitura só, os
 * resolvidos antigos ocupariam o teto e esconderiam alertas novos em aberto.
 * Lendo por estado, a fila (pendentes e em atendimento) nunca compete com o
 * histórico. O histórico, por sua vez, chega ao teto de 200 e para: o parâmetro
 * de página do banco pede "os anteriores a", e como a lista vem do mais antigo,
 * não há como buscar os mais novos depois do teto. A tela avisa quando isso
 * acontece.
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

/** Quantos resolvidos a tela abre de cada vez. */
const PASSO_HISTORICO = 10;
/** O teto de `read_alerts`: com isto na mão, pode haver mais do que a tela alcança. */
const TETO_LEITURA = 200;

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

  const pendentes = useAlertasClinicos("pendente");
  const emAtendimento = useAlertasClinicos("assumido");
  const historico = useAlertasClinicos("resolvido");
  const assumir = useAssumirAlerta();
  const resolver = useResolverAlerta();

  const [emResolucao, setEmResolucao] = useState<AlertaClinico | null>(null);
  const [emDesignacao, setEmDesignacao] = useState<AlertaClinico | null>(null);
  const [visiveis, setVisiveis] = useState(PASSO_HISTORICO);

  const fila = {
    isLoading: pendentes.isLoading || emAtendimento.isLoading,
    isError: pendentes.isError || emAtendimento.isError,
    error: pendentes.error ?? emAtendimento.error,
    refetch: () => void Promise.all([pendentes.refetch(), emAtendimento.refetch()]),
  };

  const ativos = [...(pendentes.data ?? []), ...(emAtendimento.data ?? [])].sort((a, b) => {
    const ordemA = ORDEM_SEVERIDADE.indexOf(a.severidade);
    const ordemB = ORDEM_SEVERIDADE.indexOf(b.severidade);
    return ordemA !== ordemB ? ordemA - ordemB : a.criado_em.localeCompare(b.criado_em);
  });
  const todosResolvidos = [...(historico.data ?? [])].sort((a, b) =>
    (b.resolvido_em ?? "").localeCompare(a.resolvido_em ?? ""),
  );
  const resolvidos = todosResolvidos.slice(0, visiveis);
  const historicoTruncado = (historico.data?.length ?? 0) >= TETO_LEITURA;

  const contagem = ORDEM_SEVERIDADE.map((severidade) => ({
    severidade,
    total: ativos.filter((alerta) => alerta.severidade === severidade).length,
  }));

  const carregando = fila.isLoading || historico.isLoading;
  const vazio =
    !carregando && !fila.isError && !historico.isError && ativos.length === 0 && todosResolvidos.length === 0;

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
        subtitle={
          // Fila que não carregou não tem "0 ativos": o número é desconhecido.
          fila.isError
            ? "Não foi possível ler a fila agora"
            : `${ativos.length} ativos · ordenados por gravidade`
        }
      />

      {carregando && <SkeletonCards count={3} />}

      {fila.isError && <ErrorState error={fila.error} onRetry={fila.refetch} />}

      {/* O histórico falhar sozinho também é erro: sem este aviso a seção
          simplesmente não aparecia, e a fila parecia completa. */}
      {!fila.isError && historico.isError && (
        <ErrorState compact error={historico.error} onRetry={() => void historico.refetch()} />
      )}

      {vazio && (
        <EmptyState
          title="Nenhum alerta na fila"
          description="Quando um sintoma registrado atingir o grau de criticidade configurado, ele aparece aqui."
        />
      )}

      {!carregando && !fila.isError && !vazio && (
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
                      {alerta.atribuido_a ? ` · com ${alerta.atribuido_a}` : ""}
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
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setEmDesignacao(alerta)}>
                          Designar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEmResolucao(alerta)}>
                          Resolver
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}

          {historico.isError && (
            <ErrorState compact error={historico.error} onRetry={() => void historico.refetch()} />
          )}

          {resolvidos.length > 0 && (
            <section className="flex flex-col gap-2" aria-labelledby="historico-alertas">
              <h2
                id="historico-alertas"
                className="text-muted-foreground text-xs font-medium tracking-wider uppercase"
              >
                Histórico de resolvidos
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
                    {alerta.atribuido_a ? ` · responsável: ${alerta.atribuido_a}` : ""}
                    {alerta.resolvido_em ? ` · ${formatDateTime(alerta.resolvido_em)}` : ""}
                  </p>
                  {alerta.conduta_notas && (
                    <p className="text-muted-foreground text-xs italic">{alerta.conduta_notas}</p>
                  )}
                </article>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                  Mostrando {resolvidos.length} de {todosResolvidos.length}
                  {historicoTruncado
                    ? `. O banco entrega no máximo ${TETO_LEITURA} de cada vez, dos mais antigos para os mais novos: pode haver resolvidos mais recentes que não chegam aqui.`
                    : ""}
                </p>
                {resolvidos.length < todosResolvidos.length && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVisiveis((atual) => atual + PASSO_HISTORICO)}
                  >
                    Mostrar mais
                  </Button>
                )}
              </div>
            </section>
          )}
        </>
      )}

      <DesignarAlertaDialog
        alerta={emDesignacao}
        open={emDesignacao !== null}
        onOpenChange={(aberto) => !aberto && setEmDesignacao(null)}
      />

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
