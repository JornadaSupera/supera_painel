import {
  CalendarClock,
  ChevronDown,
  Flag,
  HeartPulse,
  Lock,
  MessageSquare,
  NotebookPen,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { StatusBadge, TONE_SEVERITY } from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  ESPECIALIDADE,
  ESPECIALIDADE_LABEL,
  SEVERIDADE_LABEL,
  STATUS_ALERTA_LABEL,
  STATUS_CONVERSA_LABEL,
} from "@/lib/enums";
import { formatDate, formatDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { NoteRecordEvent, RecordEvent } from "@/types/patient-record";
import { useDiarySymptoms, useRaiseDistressFlag } from "../hooks/usePatientRecord";

/**
 * One row of the patient's timeline.
 *
 * Every kind has its own icon and its own words, and none of them relies on
 * color alone: the status is always written out.
 */

const ICON: Record<RecordEvent["kind"], LucideIcon> = {
  diary: NotebookPen,
  alert: TriangleAlert,
  conversation: MessageSquare,
  appointment: CalendarClock,
  note: HeartPulse,
  flag: Flag,
};

const KIND_LABEL: Record<RecordEvent["kind"], string> = {
  diary: "Diário do paciente",
  alert: "Alerta de sintoma",
  conversation: "Conversa",
  appointment: "Compromisso",
  note: "Anotação",
  flag: "Sinalização",
};

function DiarySymptoms({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const symptoms = useDiarySymptoms(entryId, open);

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        {open ? "Ocultar sintomas" : "Ver sintomas"}
      </Button>

      {open && symptoms.isLoading && (
        <p className="text-muted-foreground text-xs" role="status">
          Carregando sintomas…
        </p>
      )}
      {open && symptoms.isError && (
        <p className="text-destructive text-xs" role="alert">
          Não foi possível carregar os sintomas.{" "}
          <button type="button" className="underline" onClick={() => void symptoms.refetch()}>
            Tentar de novo
          </button>
        </p>
      )}
      {open && symptoms.data && symptoms.data.length === 0 && (
        <p className="text-muted-foreground text-xs">Nenhum sintoma registrado neste dia.</p>
      )}
      {open && symptoms.data && symptoms.data.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {symptoms.data.map((symptom) => (
            <li key={symptom.id}>
              <StatusBadge tone={symptom.grade >= 4 ? "warning" : "neutral"} size="sm">
                {symptom.symptom_label} · grau {symptom.grade}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlagButton({ note }: { note: NoteRecordEvent }) {
  const [confirming, setConfirming] = useState(false);
  const flag = useRaiseDistressFlag();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={flag.isPending}
        onClick={() => setConfirming(true)}
      >
        <Flag />
        Sinalizar sofrimento
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sinalizar sofrimento à equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              A equipe passa a ver que houve uma sinalização da Psicologia sobre este paciente, com a
              data. O texto da anotação não é compartilhado. A sinalização não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => flag.mutate(note.id)}>Sinalizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Content({ event, chatHref }: { event: RecordEvent; chatHref: string | null }): ReactNode {
  switch (event.kind) {
    case "diary":
      return (
        <>
          <p className="text-sm">
            Registro do dia <span className="tabular-nums">{formatDate(event.entry_date)}</span>
          </p>
          {event.free_text && (
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">{event.free_text}</p>
          )}
          <DiarySymptoms entryId={event.id} />
        </>
      );

    case "alert":
      return (
        <>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{event.symptom_label}</span>
            <span className="text-muted-foreground">grau {event.grade}</span>
            <StatusBadge tone={TONE_SEVERITY[event.severity]} size="sm">
              {SEVERIDADE_LABEL[event.severity]}
            </StatusBadge>
            <StatusBadge tone={event.status_tone} size="sm" dot>
              {STATUS_ALERTA_LABEL[event.status]}
            </StatusBadge>
          </p>
          {event.conduct_notes && (
            <p className="text-muted-foreground text-sm whitespace-pre-wrap">
              Conduta: {event.conduct_notes}
            </p>
          )}
        </>
      );

    case "conversation":
      return (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{event.subject_label}</span>
          <StatusBadge tone={event.status_tone} size="sm" dot>
            {STATUS_CONVERSA_LABEL[event.status]}
          </StatusBadge>
          {chatHref && (
            <Link
              to={chatHref}
              className="text-primary-ink text-xs underline-offset-2 hover:underline"
            >
              Abrir no chat
            </Link>
          )}
        </p>
      );

    case "appointment":
      return (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{event.type_label}</span>
          <StatusBadge tone={event.status_tone} size="sm" dot>
            {event.status_label}
          </StatusBadge>
          <span className="text-muted-foreground text-xs">
            até {formatTime(event.ends_at)}
            {event.location ? ` · ${event.location}` : ""}
          </span>
        </p>
      );

    case "note":
      return (
        <>
          <p className="text-sm whitespace-pre-wrap">{event.body}</p>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
            <span>{event.mine ? `${event.author_name} (você)` : event.author_name}</span>
            {event.restricted && (
              <span className="inline-flex items-center gap-1">
                <Lock size={12} aria-hidden="true" />
                Sob sigilo profissional
              </span>
            )}
          </p>
          {event.mine && event.specialty === ESPECIALIDADE.PSICOLOGO && <FlagButton note={event} />}
        </>
      );

    case "flag":
      return (
        <p className="text-sm">
          Sofrimento sinalizado por <span className="font-medium">{event.raised_by_name}</span>. O
          conteúdo da anotação fica com a Psicologia.
        </p>
      );
  }
}

/** `chatHref` is `null` for whoever has no clinical chat to open: the administration. */
export function TimelineEvent({ event, chatHref }: { event: RecordEvent; chatHref: string | null }) {
  const Icon = ICON[event.kind];
  const isFlag = event.kind === "flag";

  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          isFlag ? "bg-warning-bg text-warning-foreground" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon size={15} />
      </span>

      {/* Capped for reading: the record spans the whole width, and a note
          stretched across it would be one line too long to follow. */}
      <div className="flex max-w-4xl min-w-0 flex-1 flex-col gap-1.5 pb-1">
        <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
          <span className="text-foreground font-medium">{KIND_LABEL[event.kind]}</span>
          {event.specialty && <span>{ESPECIALIDADE_LABEL[event.specialty]}</span>}
          <time dateTime={event.occurred_at} className="tabular-nums">
            {formatDateTime(event.occurred_at)}
          </time>
        </p>
        <Content event={event} chatHref={chatHref} />
      </div>
    </li>
  );
}

export default TimelineEvent;
