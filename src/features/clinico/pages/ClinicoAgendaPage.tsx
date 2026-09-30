import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";

import { ErrorState, PageHeader, SkeletonCards } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/contexts/auth-context";
import {
  addDays,
  AGENDA_VIEW,
  dayStart,
  isDayKey,
  monthGrid,
  stepView,
  todayKey,
  visibleDays,
  type AgendaView,
} from "@/lib/agenda";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import { pluralize } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import type { PersonalBlock } from "@/types/agenda";
import { buildAgendaDays } from "../agenda-days";
import { AgendaMonthView } from "../components/AgendaMonthView";
import { AgendaTimeGrid } from "../components/AgendaTimeGrid";
import { ALL_TYPES, AgendaToolbar } from "../components/AgendaToolbar";
import { BlockDialog } from "../components/BlockDialog";
import { useAgendaClinica } from "../hooks/useAgendaClinica";
import { useAppointmentTypes, useBusinessHours, useMyBlocks } from "../hooks/usePersonalAgenda";

/**
 * Agenda pessoal do profissional: mês, semana e dia, com filtro por tipo, o
 * horário da clínica ao fundo e os bloqueios do próprio profissional. Cada
 * compromisso abre a ficha do paciente, dentro do painel clínico.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/farmaceutico/agenda/
 *
 * > [!] O que a tela mostra vem da URL
 * `?visao=mes|semana|dia&data=AAAA-MM-DD&tipo=…`. Assim o botão de voltar do
 * navegador desfaz a navegação pelo calendário, e um endereço copiado abre a
 * mesma agenda. O padrão (semana de hoje, todos os tipos) fica fora do endereço.
 *
 * > [!] Bloqueio não cancela nem impede compromisso
 * O agendamento no banco ainda não consulta os bloqueios. Eles marcam o tempo
 * como indisponível para a própria pessoa; o diálogo diz isso.
 */

const VIEWS = Object.values(AGENDA_VIEW) as string[];

export function ClinicoAgendaPage() {
  const { user, can } = useAuth();
  const { especialidade } = useParams<{ especialidade: string }>();
  const [params, setParams] = useSearchParams();

  const today = todayKey();
  const viewParam = params.get("visao");
  const view: AgendaView = viewParam && VIEWS.includes(viewParam) ? (viewParam as AgendaView) : AGENDA_VIEW.WEEK;
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
    if (merged.visao !== AGENDA_VIEW.WEEK) query.set("visao", merged.visao);
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

  const total = days.reduce((sum, entry) => sum + entry.appointments.length, 0);
  const newBlockDay =
    view === AGENDA_VIEW.DAY ? day : today >= range.from && today < range.to ? today : range.from;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title="Agenda"
        subtitle={
          agenda.data
            ? `${pluralize(total, "compromisso", "compromissos")} neste período`
            : "Seus compromissos e bloqueios"
        }
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
      />

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

      {agenda.data && total === 0 && (
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

      {agenda.data && view !== AGENDA_VIEW.MONTH && (
        <AgendaTimeGrid
          days={days}
          today={today}
          recordHref={recordHref}
          onOpenDay={view === AGENDA_VIEW.WEEK ? (key) => go({ visao: AGENDA_VIEW.DAY, data: key }) : undefined}
          onEditBlock={(block) => setEditing({ block })}
        />
      )}

      <p className="text-muted-foreground text-xs">
        Áreas sombreadas: clínica fechada. Listras: horário que você bloqueou.
      </p>

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
