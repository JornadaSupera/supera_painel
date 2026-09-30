import { Link } from "react-router-dom";

import {
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonCards,
  StatCard,
  StatusBadge,
} from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { ESPECIALIDADE_LABEL, SEVERIDADE_LABEL, STATUS_CONVERSA } from "@/lib/enums";
import { formatNumber, formatTime, pluralize } from "@/lib/format";
import { ConversaSemResposta } from "../components/ConversaSemResposta";
import { useAgendaClinica } from "../hooks/useAgendaClinica";
import { useAlertasClinicos } from "../hooks/useAlertasClinicos";
import { useConversasClinicas } from "../hooks/useConversasClinicas";

/**
 * Painel do dia — a tela de entrada do painel clínico.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/farmaceutico/
 *
 * Três leituras reais: a agenda de hoje (`read_my_agenda`, recortada para o
 * dia corrente) e os resumos das filas de chat e de alertas, as mesmas que as
 * telas Chat e Alertas mostram por inteiro. Aqui só as cinco mais urgentes.
 * Os três blocos se atualizam sozinhos, e a conversa pode ser respondida daqui.
 *
 * Os quatro cartões do topo saem das MESMAS leituras das listas logo abaixo, não
 * de uma conta paralela: o cartão e a lista não podem discordar. O de alertas
 * nas últimas 24 h e o de resolvidos no mês dependem de `read_alerts`, que
 * entrega no máximo 200 por situação e do mais antigo para o mais novo; quando a
 * leitura bate no teto o cartão diz "mínimo" em vez de exibir um total que
 * parece exato.
 */

const LIMITE_RESUMO = 5;
/** O teto de `read_alerts` por situação. */
const TETO_ALERTAS = 200;
const UM_DIA_MS = 24 * 60 * 60 * 1000;

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

function hoje(): { de: string; ate: string } {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);
  return { de: inicio.toISOString(), ate: fim.toISOString() };
}

export function ClinicoDashboardPage() {
  const { user } = useAuth();
  const primeiroNome = user?.nome.split(" ")[0] ?? "";
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const agendaDeHoje = useAgendaClinica(hoje());
  const compromissos = agendaDeHoje.data ?? [];
  const vazio = !agendaDeHoje.isLoading && !agendaDeHoje.isError && compromissos.length === 0;

  const base = user?.especialidade ? `/clinico/${user.especialidade}` : "/clinico";

  const conversas = useConversasClinicas();
  const semResposta = (conversas.data ?? [])
    .filter((c) => c.status === STATUS_CONVERSA.ABERTA && c.nao_lida_pela_equipe)
    .sort((a, b) => a.ultima_mensagem_em.localeCompare(b.ultima_mensagem_em));

  // Por situação, como a tela de Alertas: numa leitura só, os resolvidos antigos
  // ocupariam o teto e esconderiam os alertas novos em aberto.
  const pendentes = useAlertasClinicos("pendente");
  const emAtendimento = useAlertasClinicos("assumido");
  // Só para contar: o nome de cada paciente seria uma leitura na trilha.
  const resolvidos = useAlertasClinicos("resolvido", { semNomes: true });

  const alertas = {
    isLoading: pendentes.isLoading || emAtendimento.isLoading,
    isError: pendentes.isError || emAtendimento.isError,
    error: pendentes.error ?? emAtendimento.error,
    refetch: () => void Promise.all([pendentes.refetch(), emAtendimento.refetch()]),
  };
  const naFila = [...(pendentes.data ?? []), ...(emAtendimento.data ?? [])];

  const agora = Date.now();
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const resolvidosLimitados = (resolvidos.data?.length ?? 0) >= TETO_ALERTAS;
  const pacientesHoje = new Set(compromissos.map((compromisso) => compromisso.paciente_id)).size;
  const alertasEm24h = [...naFila, ...(resolvidos.data ?? [])].filter(
    (alerta) => agora - new Date(alerta.criado_em).getTime() <= UM_DIA_MS,
  ).length;
  const resolvidosNoMes = (resolvidos.data ?? []).filter(
    (alerta) => alerta.resolvido_em && new Date(alerta.resolvido_em) >= inicioDoMes,
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title={`${saudacao()}${primeiroNome ? `, ${primeiroNome}` : ""}`}
        subtitle="Painel do dia · pacientes agendados, mensagens e alertas da sua área"
      />

      <section aria-label="Indicadores do dia" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Pacientes hoje"
          loading={agendaDeHoje.isLoading}
          value={agendaDeHoje.isError ? "—" : formatNumber(pacientesHoje)}
          context={agendaDeHoje.isError ? "não foi possível ler a agenda" : "com compromisso marcado hoje"}
        />
        <StatCard
          label="Alertas nas últimas 24 h"
          loading={alertas.isLoading || resolvidos.isLoading}
          value={
            alertas.isError || resolvidos.isError
              ? "—"
              : `${resolvidosLimitados ? "≥ " : ""}${formatNumber(alertasEm24h)}`
          }
          context={
            alertas.isError || resolvidos.isError
              ? "não foi possível ler a fila"
              : resolvidosLimitados
                ? "leitura limitada a 200 por situação"
                : "abertos em qualquer situação"
          }
          invertColor
        />
        <StatCard
          label="Mensagens não respondidas"
          loading={conversas.isLoading}
          value={conversas.isError ? "—" : formatNumber(semResposta.length)}
          context={conversas.isError ? "não foi possível ler o chat" : "conversas aguardando a equipe"}
          invertColor
        />
        <StatCard
          label="Resolvidos no mês"
          loading={resolvidos.isLoading}
          value={
            resolvidos.isError
              ? "—"
              : `${resolvidosLimitados ? "≥ " : ""}${formatNumber(resolvidosNoMes)}`
          }
          context={
            resolvidos.isError
              ? "não foi possível ler o histórico"
              : resolvidosLimitados
                ? "leitura limitada, pode haver mais"
                : "alertas com conduta registrada"
          }
        />
      </section>

      <section className="bg-card rounded-2xl border p-5">
        <h2 className="text-foreground mb-3 text-sm font-semibold">Pacientes de hoje</h2>

        {agendaDeHoje.isLoading && <SkeletonCards count={2} />}

        {agendaDeHoje.isError && (
          <ErrorState compact error={agendaDeHoje.error} onRetry={() => void agendaDeHoje.refetch()} />
        )}

        {vazio && (
          <EmptyState
            compact
            title="Nenhum compromisso hoje"
            description="Quando houver um compromisso marcado para hoje, ele aparece aqui."
          />
        )}

        {compromissos.length > 0 && (
          <ul className="flex flex-col gap-2">
            {compromissos.map((compromisso) => (
              <li key={compromisso.id}>
                <Link
                  to={`${base}/pacientes/${compromisso.paciente_id}`}
                  className="hover:bg-muted/50 flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors"
                >
                  <span className="text-foreground w-12 shrink-0 font-medium tabular-nums">
                    {formatTime(compromisso.inicio)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{compromisso.paciente_nome}</span>
                  <StatusBadge tone={compromisso.status_tom} size="sm">
                    {compromisso.status_label}
                  </StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="bg-card rounded-2xl border p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-foreground text-sm font-semibold">Mensagens não respondidas</h2>
            <Link to={`${base}/chat`} className="text-primary text-xs font-medium hover:underline">
              Abrir chat
            </Link>
          </div>

          {conversas.isLoading && <SkeletonCards count={2} />}

          {conversas.isError && (
            <ErrorState compact error={conversas.error} onRetry={() => void conversas.refetch()} />
          )}

          {!conversas.isLoading && !conversas.isError && semResposta.length === 0 && (
            <EmptyState
              compact
              title="Nenhuma mensagem sem resposta"
              description="Conversas abertas com mensagem nova da equipe por ler aparecem aqui."
            />
          )}

          {semResposta.length > 0 && (
            <>
              <p className="text-muted-foreground mb-2 text-xs">
                {pluralize(semResposta.length, "conversa aguardando", "conversas aguardando")}
              </p>
              <ul className="flex flex-col gap-2">
                {semResposta.slice(0, LIMITE_RESUMO).map((conversa) => (
                  <ConversaSemResposta key={conversa.id} conversa={conversa} chatHref={`${base}/chat`} />
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="bg-card rounded-2xl border p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-foreground text-sm font-semibold">Fila de alertas</h2>
            <Link to={`${base}/alertas`} className="text-primary text-xs font-medium hover:underline">
              Abrir alertas
            </Link>
          </div>

          {alertas.isLoading && <SkeletonCards count={2} />}

          {alertas.isError && (
            <ErrorState compact error={alertas.error} onRetry={() => void alertas.refetch()} />
          )}

          {!alertas.isLoading && !alertas.isError && naFila.length === 0 && (
            <EmptyState
              compact
              title="Nenhum alerta na fila"
              description="Quando um sintoma passar do limite cadastrado, o alerta aparece aqui."
            />
          )}

          {naFila.length > 0 && (
            <ul className="flex flex-col gap-2">
              {naFila.slice(0, LIMITE_RESUMO).map((alerta) => (
                <li key={alerta.id}>
                  <Link
                    to={`${base}/pacientes/${alerta.paciente_id}`}
                    className="hover:bg-muted/50 flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition-colors"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {alerta.paciente_nome} · {alerta.sintoma_label}
                    </span>
                    <StatusBadge tone={alerta.status_tom} size="sm">
                      {SEVERIDADE_LABEL[alerta.severidade]}
                    </StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default ClinicoDashboardPage;
