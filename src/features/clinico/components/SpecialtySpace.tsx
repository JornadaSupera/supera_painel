import { CalendarClock, CheckCircle2, CircleAlert, Plus, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { EmptyState, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { instantParts, relativeDay, todayKey } from "@/lib/agenda";
import { ESPECIALIDADE, ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import { formatLongDate, formatTime } from "@/lib/format";
import { timelineWindowStart } from "@/lib/patient-record";
import { cn } from "@/lib/utils";
import type { PacienteDetalhe } from "@/types/paciente";
import type { AppointmentRecordEvent, PatientTimeline } from "@/types/patient-record";
import { DirectedContentCard } from "./DirectedContentCard";
import { SpecialtyNoteForm } from "./SpecialtyNoteForm";
import { TimelineEvent } from "./TimelineEvent";

/**
 * What one area's record holds beyond its notes — the workspace of each
 * specialty, as far as the data reaches.
 *
 * Every block here is filled by the database: the timeline and the next
 * appointment for Oncology, the arrival check from the patient's registration
 * for Pharmacy, today's appointments for Nursing, and the orientations sent to
 * the app for Nutrition and Physiotherapy. The rest of the prototype's spaces
 * (dispensations per cycle, the infusion room, the nutrition and functional
 * assessments, validated scales, the therapeutic plan, the dental record) has
 * no place in the database yet and is not drawn: an empty frame would read as
 * "nothing registered" when the truth is "nowhere to register".
 *
 * The prototype's "register" dialogs are not here either. They write
 * structured records, which the contracted scope leaves for a later level.
 */

interface SpaceProps {
  specialty: Especialidade;
  /** The viewer works in this area: the only case in which they write in it. */
  own: boolean;
  patient: PacienteDetalhe;
  timeline: PatientTimeline;
  chatHref: string | null;
}

function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function SpaceCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex max-w-3xl flex-col gap-0.5">
            <h2 className="text-sm font-semibold">{title}</h2>
            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/** A link to another tab of the same record. */
function TabLink({ tab, children }: { tab: string; children: ReactNode }) {
  const location = useLocation();
  return (
    <Button asChild variant="outline" size="sm" className="w-fit">
      <Link to={{ pathname: location.pathname, search: `?aba=${tab}` }}>{children}</Link>
    </Button>
  );
}

/** "Hoje · 10:00", or the date when it is more than a week away. */
function whenOf(appointment: AppointmentRecordEvent): string {
  const day = relativeDay(appointment.occurred_at) ?? formatLongDate(appointment.occurred_at);
  return `${day} · ${formatTime(appointment.occurred_at)}`;
}

/* ------------------------------------------------------------- Oncology */

function OncologySpace({ own, patient, timeline, chatHref }: SpaceProps) {
  const [writing, setWriting] = useState(false);

  // The same read the tab already holds, cut to the last 30 days. What is still
  // to come is the next appointment's job, beside it.
  const now = new Date().toISOString();
  const from = timelineWindowStart(30) ?? "";
  const recent = timeline.events.filter((event) => event.occurred_at >= from && event.occurred_at <= now);
  const next = timeline.next_appointment;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <SpaceCard title="Timeline de interações" subtitle="Últimos 30 dias · todas as fontes, da mais recente para trás">
        {recent.length === 0 ? (
          <EmptyState
            compact
            title="Nada nos últimos 30 dias"
            description="Diário, alertas, conversas, compromissos e anotações do período aparecem aqui."
          />
        ) : (
          <ol className="flex flex-col gap-4" aria-label="Interações dos últimos 30 dias">
            {recent.map((event) => (
              <TimelineEvent key={`${event.kind}-${event.id}`} event={event} chatHref={chatHref} />
            ))}
          </ol>
        )}
        <p className="text-muted-foreground text-xs">
          O histórico completo, com filtro por área e período, fica na aba Anotações.
        </p>
      </SpaceCard>

      <div className="flex flex-col gap-4">
        <SpaceCard title="Próximo compromisso">
          {next ? (
            <div className="flex items-start gap-3">
              <CalendarClock size={18} aria-hidden="true" className="text-primary-ink mt-0.5 shrink-0" />
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="font-medium">{whenOf(next)}</span>
                <span className="text-muted-foreground text-xs">
                  {next.type_label}
                  {next.specialty ? ` · ${ESPECIALIDADE_LABEL[next.specialty]}` : ""}
                  {next.location ? ` · ${next.location}` : ""}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum compromisso agendado.</p>
          )}
          <TabLink tab="agenda">Abrir agenda</TabLink>
        </SpaceCard>

        {own && (
          <SpaceCard
            title="Registrar atendimento"
            subtitle="Anotação pontual na ficha, com seu nome e a data. A evolução oficial segue no sistema da clínica."
          >
            {writing ? (
              <SpecialtyNoteForm
                patientId={patient.id}
                specialty={ESPECIALIDADE.MEDICO}
                onDone={() => setWriting(false)}
              />
            ) : (
              <Button type="button" size="sm" className="w-fit" onClick={() => setWriting(true)}>
                <Plus />
                Nova anotação
              </Button>
            )}
          </SpaceCard>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Pharmacy */

function CheckLine({
  tone,
  icon,
  children,
}: {
  tone: "success" | "danger" | "warning" | "neutral";
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm",
        tone === "success" && "bg-success-bg text-success-foreground border-success/30",
        tone === "danger" && "bg-danger-bg text-danger-foreground border-danger/30",
        tone === "warning" && "bg-warning-bg text-warning-foreground border-warning/30",
        tone === "neutral" && "bg-muted/40",
      )}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-4">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
    </div>
  );
}

function ArrivalCheck({ patient }: { patient: PacienteDetalhe }) {
  const { protocolo, alergias, reacoes_previas } = patient;

  return (
    <SpaceCard
      title="Check de chegada"
      subtitle="Conferência rápida antes da dispensação, a partir da ficha do paciente."
    >
      {protocolo ? (
        <CheckLine tone="success" icon={<CheckCircle2 />}>
          <span>
            Protocolo ativo: <strong>{protocolo.nome}</strong>
          </span>
        </CheckLine>
      ) : (
        <CheckLine tone="warning" icon={<CircleAlert />}>
          <span>Sem protocolo ativo na ficha.</span>
        </CheckLine>
      )}

      {alergias.length > 0 ? (
        <CheckLine tone="danger" icon={<TriangleAlert />}>
          <span className="font-semibold">Alergias</span>
          <span>{alergias.join(", ")}</span>
        </CheckLine>
      ) : (
        <CheckLine tone="neutral" icon={<CheckCircle2 />}>
          <span>Nenhuma alergia registrada na ficha.</span>
        </CheckLine>
      )}

      <div className="flex flex-col gap-1 px-1 text-sm">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Reações prévias
        </span>
        {reacoes_previas.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {reacoes_previas.map((reaction) => (
              <li key={reaction}>· {reaction}</li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">Nenhuma reação prévia registrada.</span>
        )}
      </div>
    </SpaceCard>
  );
}

/* -------------------------------------------------------------- Nursing */

function TodayStatus({ patient, timeline }: SpaceProps) {
  const today = todayKey();
  const appointments = timeline.events
    .filter(
      (event): event is AppointmentRecordEvent =>
        event.kind === "appointment" && instantParts(event.occurred_at).key === today,
    )
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));

  return (
    <SpaceCard
      title={`Status de hoje · ${firstNameOf(patient.nome)}`}
      subtitle="Os compromissos do paciente hoje, com qualquer área da equipe."
    >
      {appointments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhum compromisso hoje.</p>
      ) : (
        <ul className="divide-y">
          {appointments.map((appointment) => (
            <li key={appointment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <span className="font-mono text-xs tabular-nums">
                {formatTime(appointment.occurred_at)}–{formatTime(appointment.ends_at)}
              </span>
              <span className="font-medium">{appointment.title}</span>
              <StatusBadge tone={appointment.status_tone} size="sm" dot>
                {appointment.status_label}
              </StatusBadge>
              {appointment.confirmed_at && (
                <span className="text-muted-foreground text-xs">Presença confirmada no app</span>
              )}
              {appointment.location && (
                <span className="text-muted-foreground text-xs">{appointment.location}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </SpaceCard>
  );
}

/* -------------------------------------------------------------- the switch */

export function SpecialtySpace(props: SpaceProps) {
  const { specialty, own, patient } = props;
  const directed = {
    patientId: patient.id,
    patientFirstName: firstNameOf(patient.nome),
    patientCids: patient.diagnosticos.map((diagnosis) => diagnosis.cid),
    specialty,
    own,
  };

  switch (specialty) {
    case ESPECIALIDADE.MEDICO:
      return <OncologySpace {...props} />;
    case ESPECIALIDADE.FARMACEUTICO:
      return <ArrivalCheck patient={patient} />;
    case ESPECIALIDADE.ENFERMEIRO:
      return <TodayStatus {...props} />;
    case ESPECIALIDADE.NUTRICIONISTA:
      return <DirectedContentCard {...directed} variant="orientations" />;
    case ESPECIALIDADE.FISIOTERAPEUTA:
      return <DirectedContentCard {...directed} variant="exercises" />;
    default:
      // Psychology's secrecy notice and distress flag live in the tab, next to
      // its notes. Dentistry has nothing in the database beyond its notes yet.
      return null;
  }
}

export default SpecialtySpace;
