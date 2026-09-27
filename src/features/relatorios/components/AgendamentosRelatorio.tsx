import { useState } from "react";

import { CalendarClock, Pause, Play, Plus } from "lucide-react";

import { EmptyState, ErrorState, Footnote, SkeletonCards, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import { DEFINICOES } from "@/services/adapters/relatoriosDefinicoes";
import {
  FREQUENCIA_RELATORIO_LABEL,
  type AgendamentoRelatorio,
  type FrequenciaRelatorio,
} from "@/types/relatorio";
import {
  useAgendamentos,
  useAtualizarAgendamento,
  useCriarAgendamento,
  useExecucoes,
  useSetAgendamentoAtivo,
} from "../hooks/useRelatorios";

/**
 * Agendamento de relatórios — `report_schedules` + `report_runs`, desde 25/09/2026.
 *
 * O aviso chega como notificação in-app para o administrador que agendou —
 * nunca por e-mail, e nunca com o arquivo anexado, só uma referência de
 * período. Quem quiser o dado abre o painel, e o acesso fica na trilha.
 *
 * > [!] Só entrega para a própria conta.
 * A RPC aceita escolher outro destinatário, mas a tela não oferece: caberia
 * um seletor de administrador, e o ganho não paga a complexidade agora.
 */

const DIAS_SEMANA = [
  { valor: 1, label: "Segunda" },
  { valor: 2, label: "Terça" },
  { valor: 3, label: "Quarta" },
  { valor: 4, label: "Quinta" },
  { valor: 5, label: "Sexta" },
  { valor: 6, label: "Sábado" },
  { valor: 7, label: "Domingo" },
];

const RELATORIOS_AGENDAVEIS = DEFINICOES.filter((definicao) => definicao.disponivel);

function tituloDoRelatorio(slug: string): string {
  return DEFINICOES.find((definicao) => definicao.slug === slug)?.titulo ?? slug;
}

function descricaoFrequencia(agendamento: AgendamentoRelatorio): string {
  if (agendamento.frequencia === "diaria") return `Todo dia, às ${agendamento.horario}`;
  if (agendamento.frequencia === "semanal") {
    const dia = DIAS_SEMANA.find((item) => item.valor === agendamento.dia_semana)?.label ?? "?";
    return `Toda ${dia.toLowerCase()}, às ${agendamento.horario}`;
  }
  return `Todo dia ${agendamento.dia_mes} do mês, às ${agendamento.horario}`;
}

/* -------------------------------------------------------------------------
   DIÁLOGO DE CADASTRO/EDIÇÃO
   ------------------------------------------------------------------------- */

function DialogoAgendamento({
  agendamento,
  aberto,
  onFechar,
}: {
  /** `null` = cadastro novo; preenchido = editando este. */
  agendamento: AgendamentoRelatorio | null;
  aberto: boolean;
  onFechar: () => void;
}) {
  const criar = useCriarAgendamento();
  const atualizar = useAtualizarAgendamento();
  const salvando = criar.isPending || atualizar.isPending;

  const [slug, setSlug] = useState(agendamento?.slug ?? RELATORIOS_AGENDAVEIS[0]?.slug ?? "");
  const [frequencia, setFrequencia] = useState<FrequenciaRelatorio>(
    agendamento?.frequencia ?? "semanal",
  );
  const [horario, setHorario] = useState(agendamento?.horario ?? "08:00");
  const [diaSemana, setDiaSemana] = useState(agendamento?.dia_semana ?? 1);
  const [diaMes, setDiaMes] = useState(agendamento?.dia_mes ?? 1);

  const podeSalvar = Boolean(slug) && Boolean(horario);

  const salvar = () => {
    const params = {
      slug,
      frequencia,
      horario,
      diaSemana: frequencia === "semanal" ? diaSemana : null,
      diaMes: frequencia === "mensal" ? diaMes : null,
    };

    const onSuccess = () => onFechar();

    if (agendamento) atualizar.mutate({ id: agendamento.id, ...params }, { onSuccess });
    else criar.mutate(params, { onSuccess });
  };

  return (
    <Dialog open={aberto} onOpenChange={(estado) => !estado && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{agendamento ? "Editar agendamento" : "Novo agendamento"}</DialogTitle>
          <DialogDescription>
            O aviso chega como notificação no painel, para você — nunca por e-mail, e nunca com o
            arquivo anexado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agendamento-relatorio" className="text-xs">
              Relatório
            </Label>
            <Select value={slug} onValueChange={setSlug}>
              <SelectTrigger id="agendamento-relatorio">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATORIOS_AGENDAVEIS.map((definicao) => (
                  <SelectItem key={definicao.slug} value={definicao.slug}>
                    {definicao.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agendamento-frequencia" className="text-xs">
                Frequência
              </Label>
              <Select
                value={frequencia}
                onValueChange={(valor) => setFrequencia(valor as FrequenciaRelatorio)}
              >
                <SelectTrigger id="agendamento-frequencia">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(FREQUENCIA_RELATORIO_LABEL) as [FrequenciaRelatorio, string][]).map(
                    ([valor, label]) => (
                      <SelectItem key={valor} value={valor}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agendamento-horario" className="text-xs">
                Horário
              </Label>
              <Input
                id="agendamento-horario"
                type="time"
                value={horario}
                onChange={(evento) => setHorario(evento.target.value)}
              />
            </div>
          </div>

          {frequencia === "semanal" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agendamento-dia-semana" className="text-xs">
                Dia da semana
              </Label>
              <Select value={String(diaSemana)} onValueChange={(valor) => setDiaSemana(Number(valor))}>
                <SelectTrigger id="agendamento-dia-semana">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAS_SEMANA.map((dia) => (
                    <SelectItem key={dia.valor} value={String(dia.valor)}>
                      {dia.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {frequencia === "mensal" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="agendamento-dia-mes" className="text-xs">
                Dia do mês
              </Label>
              <Input
                id="agendamento-dia-mes"
                type="number"
                min={1}
                max={28}
                value={diaMes}
                onChange={(evento) => setDiaMes(Number(evento.target.value))}
              />
              <p className="text-muted-foreground text-[11px]">
                Só até o dia 28 — assim nunca pula um mês mais curto.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onFechar}>
            Cancelar
          </Button>
          <Button size="sm" disabled={!podeSalvar || salvando} onClick={salvar}>
            {salvando ? "Salvando…" : agendamento ? "Salvar" : "Agendar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------
   SEÇÃO
   ------------------------------------------------------------------------- */

export function AgendamentosRelatorio() {
  const agendamentos = useAgendamentos();
  const execucoes = useExecucoes();
  const setAtivo = useSetAgendamentoAtivo();

  // `undefined` = diálogo fechado; `null` = cadastro novo; objeto = edição.
  const [editando, setEditando] = useState<AgendamentoRelatorio | null | undefined>(undefined);

  if (agendamentos.isLoading) return <SkeletonCards count={1} />;

  if (agendamentos.isError) {
    return <ErrorState error={agendamentos.error} onRetry={() => void agendamentos.refetch()} />;
  }

  const lista = agendamentos.data ?? [];

  return (
    <section className="bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
            <CalendarClock size={15} aria-hidden="true" className="text-muted-foreground" />
            Agendamento de relatórios
          </h2>
          <p className="text-muted-foreground text-xs">
            Uma notificação no painel, no horário escolhido — nunca por e-mail
          </p>
        </div>

        <Button size="sm" variant="outline" className="shrink-0" onClick={() => setEditando(null)}>
          <Plus />
          Agendar
        </Button>
      </header>

      {lista.length === 0 ? (
        <EmptyState
          compact
          title="Nenhum relatório agendado"
          description="Agende um dos relatórios disponíveis para receber um aviso no painel quando ele estiver pronto."
        />
      ) : (
        <ul className="divide-border divide-y">
          {lista.map((agendamento) => (
            <li
              key={agendamento.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => setEditando(agendamento)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-foreground truncate text-xs font-medium">
                    {tituloDoRelatorio(agendamento.slug)}
                  </p>
                  <StatusBadge tone={agendamento.ativo ? "success" : "neutral"} size="sm" dot>
                    {agendamento.ativo ? "Ativo" : "Pausado"}
                  </StatusBadge>
                </div>
                <p className="text-muted-foreground truncate text-[11px]">
                  {descricaoFrequencia(agendamento)}
                  {agendamento.ativo && ` · próximo ${relativeTime(agendamento.proxima_em)}`}
                  {agendamento.ultima_em && ` · última vez ${formatDateTime(agendamento.ultima_em)}`}
                </p>
              </button>

              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                disabled={setAtivo.isPending}
                onClick={() =>
                  setAtivo.mutate({ id: agendamento.id, ativo: !agendamento.ativo })
                }
              >
                {agendamento.ativo ? <Pause /> : <Play />}
                {agendamento.ativo ? "Pausar" : "Retomar"}
              </Button>
            </li>
          ))}
        </ul>
      )}

      {(execucoes.data?.length ?? 0) > 0 && (
        <div className="border-border border-t pt-3">
          <h3 className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">
            Últimas gerações
          </h3>
          <ul className="flex flex-col gap-1">
            {(execucoes.data ?? []).slice(0, 5).map((execucao) => (
              <li key={execucao.id} className="text-muted-foreground flex justify-between text-[11px]">
                <span className="truncate">{tituloDoRelatorio(execucao.slug)}</span>
                <span className="shrink-0 tabular-nums">
                  {formatDate(execucao.periodo_de)}–{formatDate(execucao.periodo_ate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Footnote>
        O aviso traz uma referência de período, nunca o arquivo — quem quiser o dado abre o painel,
        e o acesso fica na trilha de auditoria. Só relatórios com origem no backend podem ser
        agendados.
      </Footnote>

      <DialogoAgendamento
        agendamento={editando ?? null}
        aberto={editando !== undefined}
        onFechar={() => setEditando(undefined)}
      />
    </section>
  );
}

export default AgendamentosRelatorio;
