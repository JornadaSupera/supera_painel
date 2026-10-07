import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { ErrorState, PageHeader, SkeletonCards, StatCard } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import { useNow } from "@/hooks/useNow";
import {
  addDays,
  AGENDA_VIEW,
  dayStart,
  isDayKey,
  minutesOfTime,
  monthGrid,
  stepView,
  timeOfMinutes,
  todayKey,
  visibleDays,
  type AgendaView,
} from "@/lib/agenda";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import { formatNumber, pluralize } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import type { BusinessHour, PersonalBlock } from "@/types/agenda";
import type { CompromissoAgenda } from "@/types/clinico";
import { buildAgendaDays } from "../agenda-days";
import { resumoDoPeriodo } from "../agenda-resumo";
import { AgendaListView } from "../components/AgendaListView";
import { AgendaMonthView } from "../components/AgendaMonthView";
import { AgendaTimeGrid } from "../components/AgendaTimeGrid";
import { ALL_TYPES, AgendaToolbar } from "../components/AgendaToolbar";
import { AppointmentActionsDialog } from "../components/AppointmentActionsDialog";
import { AppointmentFormDialog } from "../components/AppointmentFormDialog";
import { BlockDialog } from "../components/BlockDialog";
import { useAgendaClinica } from "../hooks/useAgendaClinica";
import { useAppointmentTypes, useBusinessHours, useMyBlocks } from "../hooks/usePersonalAgenda";
import { useSchedulingAccess } from "../hooks/useScheduling";

/**
 * Agenda pessoal do profissional, de duas formas: a lista dos próximos sete dias,
 * uma coluna por dia (a do protótipo, e a que abre), e a grade de mês, semana e
 * dia, com o horário da clínica ao fundo. Filtro por tipo e os bloqueios do
 * próprio profissional valem nas duas. Clicar num compromisso abre o diálogo dele
 * (detalhes, ficha do paciente e, para quem gere a agenda, as ações), nunca a
 * ficha direto.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/psicologo/agenda/
 *
 * > [!] O que a tela mostra vem da URL
 * `?visao=lista|mes|semana|dia&data=AAAA-MM-DD&tipo=…`. Assim o botão de voltar
 * do navegador desfaz a navegação pelo calendário, e um endereço copiado abre a
 * mesma agenda. O padrão (lista a partir de hoje, todos os tipos) fica fora do
 * endereço.
 *
 * > [!] Bloqueio impede marcar, mas não cancela o que já está marcado
 * O agendamento recusa o horário que colide com um bloqueio (`slot_blocked`), sem
 * dizer o motivo: só o dono lê o rótulo. O que já estava marcado continua
 * marcado, e salvar o bloqueio avisa quantos compromissos ficaram dentro dele.
 *
 * > [!] Marcar, remarcar e registrar o desfecho são de quem gere a agenda
 * O banco confere a permissão a cada chamada. A tela só pergunta uma vez
 * (`useSchedulingAccess`) para decidir se desenha os botões; sem a resposta, a
 * agenda é só de leitura.
 */

const VIEWS = Object.values(AGENDA_VIEW) as string[];
const DEFAULT_VIEW: AgendaView = AGENDA_VIEW.LIST;

const VIEW_TITLE: Record<AgendaView, string> = {
  lista: "Sua semana",
  semana: "Sua semana",
  dia: "Seu dia",
  mes: "Seu mês",
};

/** "08:00–18:00": from the earliest opening to the latest closing of the week. */
function clinicHours(hours: BusinessHour[]): string | null {
  if (hours.length === 0) return null;
  const opens = Math.min(...hours.map((hour) => minutesOfTime(hour.opens_at)));
  const closes = Math.max(...hours.map((hour) => minutesOfTime(hour.closes_at)));
  return `${timeOfMinutes(opens)}–${timeOfMinutes(closes)}`;
}

export function ClinicoAgendaPage() {
  const { user, can } = useAuth();
  const { especialidade } = useParams<{ especialidade: string }>();
  const [params, setParams] = useSearchParams();

  // A hora corrente, renovada a cada minuto com a aba visível: move a linha do
  // "agora" e faz o dia de hoje virar sozinho à meia-noite.
  const now = useNow();
  const today = todayKey(now);
  const viewParam = params.get("visao");
  const view: AgendaView = viewParam && VIEWS.includes(viewParam) ? (viewParam as AgendaView) : DEFAULT_VIEW;
  const dayParam = params.get("data");
  const day = isDayKey(dayParam) ? dayParam : today;
  const type = params.get("tipo") ?? ALL_TYPES;

  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";
  const recordHref = can(PERMISSAO.PACIENTES_READ)
    ? (patientId: string) => `/clinico/${especialidade}/pacientes/${patientId}`
    : null;

  /** Writes the address, dropping whatever is the default so it stays short. */
  const go = (next: { visao?: AgendaView; data?: string; tipo?: string }) => {
    const merged = { visao: view, data: day, tipo: type, ...next };
    const query = new URLSearchParams();
    if (merged.visao !== DEFAULT_VIEW) query.set("visao", merged.visao);
    if (merged.data !== today) query.set("data", merged.data);
    if (merged.tipo !== ALL_TYPES) query.set("tipo", merged.tipo);
    setParams(query);
  };

  const range = visibleDays(view, day);
  const from = dayStart(range.from);
  const to = dayStart(range.to);

  const agenda = useAgendaClinica({ de: from, ate: to, semNomes: view === AGENDA_VIEW.MONTH });
  const blocks = useMyBlocks({ from, to });
  const hours = useBusinessHours();
  const types = useAppointmentTypes();

  const days = useMemo(() => {
    const keys: string[] = [];
    for (let key = range.from; key < range.to; key = addDays(key, 1)) keys.push(key);

    const appointments = (agenda.data ?? []).filter(
      (appointment) => type === ALL_TYPES || appointment.tipo_label === type,
    );
    return buildAgendaDays(keys, appointments, blocks.data ?? [], hours.data ?? []);
  }, [range.from, range.to, agenda.data, blocks.data, hours.data, type]);

  const weeks = useMemo(() => {
    if (view !== AGENDA_VIEW.MONTH) return [];
    const byKey = new Map(days.map((entry) => [entry.key, entry]));
    return monthGrid(day).map((week) => week.flatMap((key) => byKey.get(key) ?? []));
  }, [view, day, days]);

  const [editing, setEditing] = useState<{ block: PersonalBlock | null } | null>(null);

  const access = useSchedulingAccess();
  const canSchedule = access.data?.allowed === true;
  const [booking, setBooking] = useState(false);
  const [opened, setOpened] = useState<CompromissoAgenda | null>(null);
  const [moving, setMoving] = useState<CompromissoAgenda | null>(null);

  const total = days.reduce((sum, entry) => sum + entry.appointments.length, 0);
  const resumo = resumoDoPeriodo(
    days.flatMap((entry) => entry.appointments.map((item) => item.appointment)),
  );
  const newBlockDay =
    view === AGENDA_VIEW.DAY ? day : today >= range.from && today < range.to ? today : range.from;

  // The account's name falls back to the e-mail; an address is not a name to show.
  const ownName = user && user.nome !== user.email ? user.nome : null;
  const hoursLabel = clinicHours(hours.data ?? []);
  const subtitle =
    [ownName, hoursLabel ? `horário ${hoursLabel}` : null].filter(Boolean).join(" · ") ||
    "Seus compromissos e bloqueios";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area ? `${area} · Agenda` : "Agenda"}
        title={VIEW_TITLE[view]}
        subtitle={subtitle}
      />

      <AgendaToolbar
        view={view}
        day={day}
        onViewChange={(next) => go({ visao: next })}
        onStep={(direction) => go({ data: stepView(view, day, direction) })}
        onToday={() => go({ data: today })}
        type={type}
        types={types.data ?? []}
        onTypeChange={(next) => go({ tipo: next })}
        onNewBlock={() => setEditing({ block: null })}
        onNewAppointment={canSchedule ? () => setBooking(true) : undefined}
      />

      {agenda.data && (
        <section aria-label="Resumo do período" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard label="Compromissos" value={formatNumber(resumo.total)} context="neste período" />
          <StatCard label="Realizados" value={formatNumber(resumo.realizados)} context="com desfecho registrado" />
          <StatCard label="Faltas" value={formatNumber(resumo.faltas)} context="paciente não compareceu" invertColor />
          <StatCard
            label="Reagendados ou cancelados"
            value={formatNumber(resumo.reagendados + resumo.cancelados)}
            context={`${pluralize(resumo.reagendados, "reagendado", "reagendados")} · ${pluralize(resumo.cancelados, "cancelado", "cancelados")}`}
            invertColor
          />
        </section>
      )}

      {agenda.isLoading && <SkeletonCards count={3} />}

      {agenda.isError && <ErrorState error={agenda.error} onRetry={() => void agenda.refetch()} />}

      {(blocks.isError || hours.isError) && (
        <Alert role="status">
          <AlertDescription>
            Não foi possível carregar {blocks.isError ? "seus bloqueios" : "o horário da clínica"}. Os
            compromissos aparecem normalmente.
          </AlertDescription>
        </Alert>
      )}

      {/* The list says it day by day; the grids need the sentence. */}
      {agenda.data && total === 0 && view !== AGENDA_VIEW.LIST && (
        <p className="text-muted-foreground text-sm" role="status">
          {type === ALL_TYPES
            ? "Nenhum compromisso neste período."
            : `Nenhum compromisso do tipo “${type}” neste período.`}
        </p>
      )}

      {agenda.data && view === AGENDA_VIEW.MONTH && (
        <AgendaMonthView
          weeks={weeks}
          today={today}
          month={day}
          onOpenDay={(key) => go({ visao: AGENDA_VIEW.DAY, data: key })}
        />
      )}

      {agenda.data && view === AGENDA_VIEW.LIST && (
        <AgendaListView
          days={days}
          today={today}
          now={now}
          onOpen={setOpened}
          onEditBlock={(block) => setEditing({ block })}
        />
      )}

      {agenda.data && (view === AGENDA_VIEW.WEEK || view === AGENDA_VIEW.DAY) && (
        <AgendaTimeGrid
          days={days}
          today={today}
          now={now}
          onOpenDay={view === AGENDA_VIEW.WEEK ? (key) => go({ visao: AGENDA_VIEW.DAY, data: key }) : undefined}
          onEditBlock={(block) => setEditing({ block })}
          onOpen={setOpened}
        />
      )}

      {view !== AGENDA_VIEW.LIST && (
        <p className="text-muted-foreground text-xs">
          Áreas sombreadas: clínica fechada. Listras: horário que você bloqueou, onde ninguém marca
          compromisso.
        </p>
      )}

      <AppointmentFormDialog
        open={booking || moving !== null}
        onOpenChange={(open) => {
          if (!open) {
            setBooking(false);
            setMoving(null);
          }
        }}
        appointment={moving}
        defaultDay={newBlockDay}
        access={access.data ?? null}
        area={user?.especialidade ?? null}
      />

      <AppointmentActionsDialog
        appointment={opened}
        onOpenChange={(open) => !open && setOpened(null)}
        onReschedule={(appointment) => {
          setOpened(null);
          setMoving(appointment);
        }}
        recordHref={recordHref}
        canManage={canSchedule}
      />

      <BlockDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        block={editing?.block ?? null}
        defaultDay={newBlockDay}
      />
    </div>
  );
}

export default ClinicoAgendaPage;
