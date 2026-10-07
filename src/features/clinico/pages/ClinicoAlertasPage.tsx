import { CircleCheck, Clock, NotebookPen } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionHeading,
  SkeletonCards,
  StatusBadge,
  UserAvatar,
} from "@/components/shared";
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
import { pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AlertaClinico } from "@/types/clinico";
import { SEVERITY_EDGE } from "../alert-tones";
import { AlertContext } from "../components/AlertContext";
import { DesignarAlertaDialog } from "../components/DesignarAlertaDialog";
import { DistressFlagBadge } from "../components/DistressFlagNotice";
import { DialogResolverAlerta } from "../components/DialogResolverAlerta";
import { useAlertasClinicos, useAssumirAlerta, useResolverAlerta } from "../hooks/useAlertasClinicos";

/**
 * Fila de alertas — priorizada por gravidade, compartilhada pela equipe.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/psicologo/alertas/
 *
 * Cada alerta nasce de um registro do diário: a etiqueta de origem diz isso, e
 * se quem registrou foi o acompanhante. O protótipo mostra alertas de chat, de
 * sistema e de IA; o banco não tem nenhum deles, e a tela não os imita.
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


export function ClinicoAlertasPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";
  const base = user?.especialidade ? `/clinico/${user.especialidade}` : "/clinico";

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
        eyebrow={area ? `${area} · Fila de alertas` : "Fila de alertas"}
        title="Triagem priorizada"
        subtitle={
          // Fila que não carregou não tem "0 ativos": o número é desconhecido.
          fila.isError
            ? "Não foi possível ler a fila agora"
            : `${pluralize(ativos.length, "ativo", "ativos")} · ordenados por gravidade`
        }
      />

      {carregando && <SkeletonCards count={3} />}

      {fila.isError && <ErrorState error={fila.error} onRetry={fila.refetch} />}

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
                className={`rounded-xl border border-l-4 p-3 ${SEVERITY_EDGE[severidade]}`}
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
              <SectionHeading>Ativos</SectionHeading>

              {ativos.map((alerta) => (
                <article
                  key={alerta.id}
                  className={cn(
                    "bg-card flex flex-col gap-3 rounded-2xl border border-l-4 p-4 md:flex-row md:items-start",
                    SEVERITY_EDGE[alerta.severidade],
                  )}
                >
                  <UserAvatar name={alerta.paciente_nome} size="md" className="max-md:hidden" />

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-foreground text-sm font-semibold">{alerta.paciente_nome}</p>
                      <StatusBadge tone={TOM_POR_SEVERIDADE[alerta.severidade]} size="sm" pill>
                        {SEVERIDADE_LABEL[alerta.severidade]}
                      </StatusBadge>
                      <StatusBadge tone="neutral" size="sm" pill className="bg-card">
                        <NotebookPen size={11} aria-hidden="true" />
                        {alerta.pelo_acompanhante ? "diário · acompanhante" : "diário"}
                      </StatusBadge>
                      <DistressFlagBadge patientId={alerta.paciente_id} />
                    </div>

                    <p className="text-sm">
                      {alerta.sintoma_label} (grau {alerta.grau})
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Registrado no diário {alerta.pelo_acompanhante ? "pelo acompanhante" : "pelo paciente"}
                      {alerta.atribuido_a ? ` · com ${alerta.atribuido_a}` : ""}
                    </p>

                    <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-[11px]">
                      <Clock size={12} aria-hidden="true" />
                      {relativeTime(alerta.criado_em)}
                      <span aria-hidden="true">·</span>
                      <span>
                        Status: <span className="text-foreground font-semibold">{STATUS_ALERTA_LABEL[alerta.status]}</span>
                      </span>
                    </p>

                    <AlertContext alerta={alerta} />

                    {alerta.conduta_notas && (
                      <p className="bg-muted/60 mt-1 rounded-lg px-3 py-2 text-xs">
                        <span className="font-semibold">Conduta:</span> {alerta.conduta_notas}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 md:flex-col md:items-end">
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
                        <CircleCheck />
                        Resolver
                      </Button>
                    )}
                    <div className="flex gap-1">
                      {alerta.status === "assumido" && (
                        <Button size="sm" variant="ghost" onClick={() => setEmDesignacao(alerta)}>
                          Designar
                        </Button>
                      )}
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`${base}/pacientes/${alerta.paciente_id}`}>Ver ficha</Link>
                      </Button>
                    </div>
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
              <SectionHeading id="historico-alertas">Resolvidos recentemente</SectionHeading>

              {resolvidos.map((alerta) => (
                <article key={alerta.id} className="bg-card flex items-start gap-3 rounded-2xl border p-4">
                  <CircleCheck size={16} aria-hidden="true" className="text-success mt-0.5 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm">
                      <Link
                        to={`${base}/pacientes/${alerta.paciente_id}`}
                        className="text-foreground font-medium hover:underline"
                      >
                        {alerta.paciente_nome}
                      </Link>
                      <span className="text-muted-foreground">
                        {" "}
                        · {alerta.sintoma_label} (grau {alerta.grau})
                      </span>
                      <span className="sr-only">, resolvido</span>
                    </p>
                    {(alerta.conduta_tipo || alerta.conduta_notas) && (
                      <p className="text-muted-foreground text-xs">
                        Conduta:{" "}
                        {[
                          alerta.conduta_tipo ? CONDUTA_ALERTA_LABEL[alerta.conduta_tipo] : null,
                          alerta.conduta_notas,
                        ]
                          .filter(Boolean)
                          .join(" — ")}
                      </p>
                    )}
                    <p className="text-muted-foreground text-[11px]">
                      {alerta.resolvido_em ? `Resolvido ${relativeTime(alerta.resolvido_em)}` : "Resolvido"}
                      {alerta.atribuido_a ? ` · responsável: ${alerta.atribuido_a}` : ""}
                    </p>
                  </div>
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
