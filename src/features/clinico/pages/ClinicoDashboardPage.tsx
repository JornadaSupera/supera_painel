import { ChevronRight, CircleCheck, MessageCircle, TriangleAlert, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonRows,
  StatCard,
  StatusBadge,
  UserAvatar,
} from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { useNow } from "@/hooks/useNow";
import { addDays, dayStart, todayKey } from "@/lib/agenda";
import {
  ESPECIALIDADE_LABEL,
  SEVERIDADE,
  SEVERIDADE_LABEL,
  STATUS_ALERTA_LABEL,
  STATUS_CONVERSA,
  type Severidade,
} from "@/lib/enums";
import { formatNumber, formatTime, pluralize, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AlertaClinico, CompromissoAgenda } from "@/types/clinico";
import type { PacienteListItem } from "@/types/paciente";
import { SEVERITY_DOT, SEVERITY_RANK } from "../alert-tones";
import { ConversaSemResposta } from "../components/ConversaSemResposta";
import { DistressFlagBadge } from "../components/DistressFlagNotice";
import { useAgendaClinica } from "../hooks/useAgendaClinica";
import { useAlertasClinicos } from "../hooks/useAlertasClinicos";
import { useConversasClinicas } from "../hooks/useConversasClinicas";
import { useMeuDesempenho } from "../hooks/useMeuDesempenho";
import { usePacientesPorId } from "../hooks/useMeusPacientes";

/**
 * Painel do dia — a tela de entrada do painel clínico.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/psicologo/
 *
 * O painel é de quem está logado, não da equipe:
 *  - a agenda de hoje é a sua (`read_my_agenda`, recortada para o dia corrente
 *    no fuso da clínica);
 *  - as conversas são as suas e as sem responsável da sua área — a mesma lista
 *    da tela Chat;
 *  - os alertas são os que estão com você e os que ainda não têm responsável.
 *    Esses ficam à vista de todos de propósito: alerta não é roteado a ninguém
 *    até alguém assumir, e esconder a fila arriscaria um alerta grave sem dono;
 *  - resolvidas no mês e tempo de resposta são os seus
 *    (`summarize_my_portfolio`).
 *
 * Protocolo e CID de cada paciente do dia saem de UMA leitura da lista, não de
 * três leituras de ficha por pessoa. Os cartões do topo saem das mesmas leituras
 * das listas logo abaixo: o cartão e a lista não podem discordar.
 *
 * Fica de fora o risco de cada paciente: ele vem do Gemed, que não está ligado.
 */

const LIMITE_RESUMO = 5;
const UM_DIA_MS = 24 * 60 * 60 * 1000;
const GRAVES: ReadonlySet<Severidade> = new Set([SEVERIDADE.ALTA, SEVERIDADE.CRITICA]);

function saudacao(agora: Date): string {
  const hora = Number(
    agora.toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }),
  );
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

/** "terça-feira, 7 de outubro" — o dia de hoje, no fuso da clínica. */
function diaPorExtenso(agora: Date): string {
  return agora.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** O início do mês anterior, do corrente e do próximo, em ISO 8601 UTC. */
function inicioDosMeses(hoje: string): { anterior: string; atual: string; proximo: string } {
  const primeiro = `${hoje.slice(0, 7)}-01`;
  const anterior = addDays(primeiro, -1).slice(0, 7);
  const proximo = addDays(primeiro, 32).slice(0, 7);
  return {
    anterior: dayStart(`${anterior}-01`),
    atual: dayStart(primeiro),
    proximo: dayStart(`${proximo}-01`),
  };
}

/** Cabeçalho de um bloco: título, apoio e o atalho para a tela inteira. */
function BlockHeader({
  title,
  subtitle,
  to,
  linkLabel,
}: {
  title: string;
  subtitle?: ReactNode;
  to: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
      </div>
      <Link
        to={to}
        className="text-primary-ink inline-flex shrink-0 items-center gap-0.5 text-xs font-medium hover:underline"
      >
        {linkLabel}
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}

/** "FOLFOX · C18.9" — o que a lista sabe do paciente; sem ela, o nome do compromisso. */
function linhaClinica(compromisso: CompromissoAgenda, paciente: PacienteListItem | undefined): string {
  const partes = [
    paciente?.protocolo_nome && paciente.protocolo_nome !== "—" ? paciente.protocolo_nome : null,
    paciente?.cid || null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : compromisso.titulo;
}

function PacienteDoDia({
  compromisso,
  paciente,
  href,
}: {
  compromisso: CompromissoAgenda;
  paciente: PacienteListItem | undefined;
  href: string;
}) {
  return (
    <li>
      <Link
        to={href}
        className="hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-3 px-4 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span className="w-12 shrink-0 font-mono text-sm tabular-nums">{formatTime(compromisso.inicio)}</span>
        <UserAvatar name={compromisso.paciente_nome} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{compromisso.paciente_nome}</span>
            <DistressFlagBadge patientId={compromisso.paciente_id} />
          </span>
          <span className="text-muted-foreground truncate text-xs">{linhaClinica(compromisso, paciente)}</span>
        </span>
        <StatusBadge tone={compromisso.status_tom} size="sm" pill>
          {compromisso.status_label}
        </StatusBadge>
        <ChevronRight size={16} aria-hidden="true" className="text-muted-foreground shrink-0" />
      </Link>
    </li>
  );
}

function AlertaNaFila({ alerta, href }: { alerta: AlertaClinico; href: string }) {
  return (
    <li>
      <Link
        to={href}
        className="hover:bg-muted/50 focus-visible:ring-ring flex items-start gap-2.5 px-4 py-3 transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
      >
        <span
          aria-hidden="true"
          className={cn("mt-1.5 size-2 shrink-0 rounded-full", SEVERITY_DOT[alerta.severidade])}
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium">{alerta.paciente_nome}</span>
            <DistressFlagBadge patientId={alerta.paciente_id} />
          </span>
          <span className="text-muted-foreground text-xs">
            {alerta.sintoma_label} · grau {alerta.grau}
            <span className="sr-only">, severidade {SEVERIDADE_LABEL[alerta.severidade]}</span>
          </span>
          <span className="text-muted-foreground text-[11px]">
            {relativeTime(alerta.criado_em)} · {STATUS_ALERTA_LABEL[alerta.status]}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function ClinicoDashboardPage() {
  const { user } = useAuth();
  const agora = useNow();
  const hoje = todayKey(agora);

  // O nome da conta cai no e-mail quando não há nome cadastrado; e-mail não é saudação.
  const primeiroNome = user && user.nome !== user.email ? (user.nome.split(" ")[0] ?? "") : "";
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";
  const base = user?.especialidade ? `/clinico/${user.especialidade}` : "/clinico";

  const agendaDeHoje = useAgendaClinica({ de: dayStart(hoje), ate: dayStart(addDays(hoje, 1)) });
  const compromissos = agendaDeHoje.data ?? [];
  const pacientes = usePacientesPorId(compromissos.length > 0);

  // Suas conversas e as sem responsável da sua área: a lista já chega assim.
  const conversas = useConversasClinicas();
  const semResposta = (conversas.data ?? [])
    .filter((c) => c.status === STATUS_CONVERSA.ABERTA && c.nao_lida_pela_equipe)
    .sort((a, b) => a.ultima_mensagem_em.localeCompare(b.ultima_mensagem_em));

  // Os seus números no mês e no anterior, para a variação.
  const meses = inicioDosMeses(hoje);
  const noMes = useMeuDesempenho(meses.atual, meses.proximo);
  const noMesAnterior = useMeuDesempenho(meses.anterior, meses.atual);
  const minutos = noMes.data?.tempo_medio_minutos ?? null;

  // Por situação, como a tela de Alertas: numa leitura só, os resolvidos antigos
  // ocupariam o teto e esconderiam os alertas novos em aberto.
  const pendentes = useAlertasClinicos("pendente");
  const emAtendimento = useAlertasClinicos("assumido");

  const alertas = {
    isLoading: pendentes.isLoading || emAtendimento.isLoading,
    isError: pendentes.isError || emAtendimento.isError,
    error: pendentes.error ?? emAtendimento.error,
    refetch: () => void Promise.all([pendentes.refetch(), emAtendimento.refetch()]),
  };
  // Sem responsável, e os que estão com você. Os que um colega assumiu ficam
  // na tela Alertas.
  const comigo = (emAtendimento.data ?? []).filter((alerta) => alerta.meu);
  const naFila = [...(pendentes.data ?? []), ...comigo].sort(
    (a, b) =>
      SEVERITY_RANK[a.severidade] - SEVERITY_RANK[b.severidade] || a.criado_em.localeCompare(b.criado_em),
  );
  const graves = naFila.filter((alerta) => GRAVES.has(alerta.severidade)).length;

  const instante = agora.getTime();

  const pacientesHoje = new Set(compromissos.map((compromisso) => compromisso.paciente_id)).size;
  const proximo = compromissos
    .filter(
      (compromisso) => compromisso.status_codigo === "scheduled" && Date.parse(compromisso.inicio) > instante,
    )
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];

  const gravesEm24h = naFila.filter(
    (alerta) => GRAVES.has(alerta.severidade) && instante - Date.parse(alerta.criado_em) <= UM_DIA_MS,
  ).length;

  const resolvidosNoMes = noMes.data?.alertas_resolvidos ?? 0;
  const resolvidosNoAnterior = noMesAnterior.data?.alertas_resolvidos ?? 0;
  // Variação só com base: sem resolvidas no mês anterior não há porcentagem que signifique algo.
  const variacao =
    noMesAnterior.data && resolvidosNoAnterior > 0
      ? Math.round(((resolvidosNoMes - resolvidosNoAnterior) / resolvidosNoAnterior) * 100)
      : undefined;

  const subtitulo = (
    <span className="first-letter:uppercase">
      {diaPorExtenso(agora)}
      {agendaDeHoje.data && <> · {pluralize(pacientesHoje, "paciente agendado", "pacientes agendados")}</>}
      {!alertas.isLoading && !alertas.isError && (
        <>
          {" · "}
          {graves > 0 ? (
            <span className="text-destructive font-medium">
              {pluralize(graves, "alerta grave", "alertas graves")}
            </span>
          ) : (
            "nenhum alerta grave"
          )}
        </>
      )}
    </span>
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title={`${saudacao(agora)}${primeiroNome ? `, ${primeiroNome}` : ""}`}
        subtitle={subtitulo}
      />

      <section aria-label="Indicadores do dia" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          icon={<Users />}
          label="Pacientes hoje"
          loading={agendaDeHoje.isLoading}
          value={agendaDeHoje.isError ? "—" : formatNumber(pacientesHoje)}
          context={
            agendaDeHoje.isError
              ? "não foi possível ler a agenda"
              : proximo
                ? `Próximo às ${formatTime(proximo.inicio)}`
                : compromissos.length > 0
                  ? "nenhum outro hoje"
                  : "nenhum compromisso hoje"
          }
        />
        <StatCard
          icon={<TriangleAlert />}
          accent="bg-destructive/10 text-destructive"
          label="Alertas graves 24 h"
          loading={alertas.isLoading}
          value={alertas.isError ? "—" : formatNumber(gravesEm24h)}
          context={alertas.isError ? "não foi possível ler a fila" : "Sem responsável ou com você"}
          invertColor
        />
        <StatCard
          icon={<MessageCircle />}
          accent="bg-info/10 text-info-foreground"
          label="Mensagens não resp."
          loading={conversas.isLoading}
          value={conversas.isError ? "—" : formatNumber(semResposta.length)}
          context={
            conversas.isError
              ? "não foi possível ler o chat"
              : minutos === null
                ? "Seu tempo médio: sem respostas no mês"
                : `Seu tempo médio: ${formatNumber(minutos)} min`
          }
          invertColor
        />
        <StatCard
          icon={<CircleCheck />}
          accent="bg-success/10 text-success-foreground"
          label="Resolvidas por você (mês)"
          loading={noMes.isLoading}
          value={noMes.isError ? "—" : formatNumber(resolvidosNoMes)}
          delta={variacao}
          period="vs anterior"
          context={
            noMes.isError ? "não foi possível ler os seus números" : "alertas com conduta registrada"
          }
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="bg-card overflow-hidden rounded-2xl border lg:col-span-2">
          <BlockHeader
            title="Pacientes do dia"
            subtitle={
              agendaDeHoje.data
                ? `${pluralize(compromissos.length, "agendamento", "agendamentos")} · acesso rápido à ficha`
                : "acesso rápido à ficha"
            }
            to={`${base}/agenda`}
            linkLabel="Lista completa"
          />

          {agendaDeHoje.isLoading && <SkeletonRows count={3} className="p-4" />}

          {agendaDeHoje.isError && (
            <div className="p-4">
              <ErrorState compact error={agendaDeHoje.error} onRetry={() => void agendaDeHoje.refetch()} />
            </div>
          )}

          {agendaDeHoje.data && compromissos.length === 0 && (
            <EmptyState
              compact
              title="Nenhum compromisso hoje"
              description="Quando houver um compromisso marcado para hoje, ele aparece aqui."
            />
          )}

          {compromissos.length > 0 && (
            <ul className="divide-y">
              {compromissos.map((compromisso) => (
                <PacienteDoDia
                  key={compromisso.id}
                  compromisso={compromisso}
                  paciente={pacientes.porId.get(compromisso.paciente_id)}
                  href={`${base}/pacientes/${compromisso.paciente_id}`}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card overflow-hidden rounded-2xl border">
          <BlockHeader
            title="Fila de alertas"
            subtitle="Sem responsável e os seus, por gravidade"
            to={`${base}/alertas`}
            linkLabel="Ver fila"
          />

          {alertas.isLoading && <SkeletonRows count={3} className="p-4" />}

          {alertas.isError && (
            <div className="p-4">
              <ErrorState compact error={alertas.error} onRetry={() => alertas.refetch()} />
            </div>
          )}

          {!alertas.isLoading && !alertas.isError && naFila.length === 0 && (
            <EmptyState
              compact
              title="Nenhum alerta na fila"
              description="Quando um sintoma passar do limite cadastrado, o alerta aparece aqui."
            />
          )}

          {naFila.length > 0 && (
            <ul className="divide-y">
              {naFila.slice(0, LIMITE_RESUMO).map((alerta) => (
                <AlertaNaFila
                  key={alerta.id}
                  alerta={alerta}
                  href={`${base}/pacientes/${alerta.paciente_id}`}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-card overflow-hidden rounded-2xl border">
        <BlockHeader
          title="Mensagens não respondidas"
          subtitle="Suas conversas e as sem responsável da sua área"
          to={`${base}/chat`}
          linkLabel="Abrir chat"
        />

        {conversas.isLoading && <SkeletonRows count={2} className="p-4" />}

        {conversas.isError && (
          <div className="p-4">
            <ErrorState compact error={conversas.error} onRetry={() => void conversas.refetch()} />
          </div>
        )}

        {!conversas.isLoading && !conversas.isError && semResposta.length === 0 && (
          <EmptyState
            compact
            title="Nenhuma mensagem sem resposta"
            description="Conversas abertas com mensagem nova do paciente aparecem aqui."
          />
        )}

        {semResposta.length > 0 && (
          <ul className="divide-y">
            {semResposta.slice(0, LIMITE_RESUMO).map((conversa) => (
              <ConversaSemResposta key={conversa.id} conversa={conversa} chatHref={`${base}/chat`} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default ClinicoDashboardPage;
