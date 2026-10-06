import { CalendarClock, Lock, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState, ErrorState, SkeletonCards } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ESPECIALIDADE, ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import { TIMELINE_WINDOW_OPTIONS } from "@/lib/patient-record";
import type { AppointmentRecordEvent, TimelineWindow } from "@/types/patient-record";
import { usePatientTimeline } from "../hooks/usePatientRecord";
import { SpecialtyNoteForm } from "./SpecialtyNoteForm";
import { TimelineEvent } from "./TimelineEvent";

/**
 * The multidisciplinary view of a patient, inside the clinical record.
 *
 * One list, two controls: how far back to look, and whose part of the story. "Todas
 * as áreas" is the whole timeline; picking an area keeps what that area wrote and
 * did. The diary and the alerts are the patient's own reports and belong to no
 * area, so they only show under "Todas as áreas".
 *
 * Secrecy is the database's, not this screen's. What Psychology restricted does
 * not arrive for anyone else; the screen only explains the gap when that area is
 * picked, and keeps showing the flags, which are meant for everyone.
 */

const ALL = "all";
type AreaFilter = Especialidade | typeof ALL;

const AREAS = Object.values(ESPECIALIDADE);

function NextAppointment({ appointment }: { appointment: AppointmentRecordEvent | null }) {
  return (
    <div className="bg-muted/40 flex items-start gap-3 rounded-xl border px-4 py-3">
      <CalendarClock size={18} aria-hidden="true" className="text-primary-ink mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5 text-sm">
        <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
          Próximo compromisso
        </span>
        {appointment ? (
          <span>
            <span className="font-medium">{appointment.type_label}</span> ·{" "}
            <time dateTime={appointment.occurred_at} className="tabular-nums">
              {formatDateTime(appointment.occurred_at)}
            </time>
            {appointment.location ? ` · ${appointment.location}` : ""}
            {appointment.specialty ? ` · ${ESPECIALIDADE_LABEL[appointment.specialty]}` : ""}
          </span>
        ) : (
          <span className="text-muted-foreground">Nenhum compromisso agendado.</span>
        )}
      </div>
    </div>
  );
}

export function PatientRecordPanel({
  patientId,
  area,
  chatHref,
}: {
  patientId: string;
  /** The professional's own specialty: the one they can write in. */
  area: Especialidade;
  chatHref: string;
}) {
  const [days, setDays] = useState<TimelineWindow>(30);
  const [filter, setFilter] = useState<AreaFilter>(ALL);
  const [writing, setWriting] = useState(false);

  const timeline = usePatientTimeline(patientId, days);

  const visible = useMemo(() => {
    const events = timeline.data?.events ?? [];
    return filter === ALL ? events : events.filter((event) => event.specialty === filter);
  }, [timeline.data, filter]);

  const withheld =
    filter !== ALL &&
    filter !== area &&
    (timeline.data?.confidential_specialties ?? []).includes(filter);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Linha do tempo multidisciplinar</h2>
            <p className="text-muted-foreground text-xs">
              O que o paciente registrou e o que a equipe fez e escreveu, do mais recente para trás.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="record-area" className="text-xs">
                Área
              </Label>
              <Select value={filter} onValueChange={(value) => setFilter(value as AreaFilter)}>
                <SelectTrigger id="record-area" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as áreas</SelectItem>
                  {AREAS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ESPECIALIDADE_LABEL[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="record-window" className="text-xs">
                Período
              </Label>
              <Select
                value={String(days)}
                onValueChange={(value) => setDays(value === "null" ? null : (Number(value) as TimelineWindow))}
              >
                <SelectTrigger id="record-window" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMELINE_WINDOW_OPTIONS.map((option) => (
                    <SelectItem key={String(option.value)} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {timeline.isLoading && <SkeletonCards count={3} />}

        {timeline.isError && (
          <ErrorState error={timeline.error} onRetry={() => void timeline.refetch()} compact />
        )}

        {timeline.data && (
          <>
            <NextAppointment appointment={timeline.data.next_appointment} />

            {writing ? (
              <SpecialtyNoteForm
                patientId={patientId}
                specialty={area}
                onDone={() => setWriting(false)}
              />
            ) : (
              <Button type="button" variant="outline" className="w-fit" onClick={() => setWriting(true)}>
                <Plus />
                Nova anotação · {ESPECIALIDADE_LABEL[area]}
              </Button>
            )}

            {withheld && (
              <Alert role="status">
                <Lock />
                <AlertTitle>Conteúdo sob sigilo profissional</AlertTitle>
                <AlertDescription>
                  As anotações, conversas e compromissos de {ESPECIALIDADE_LABEL[filter as Especialidade]}{" "}
                  ficam só com a própria área. Você vê apenas as sinalizações, que são para toda a equipe.
                </AlertDescription>
              </Alert>
            )}

            {filter !== ALL && !withheld && (
              <p className="text-muted-foreground text-xs">
                Mostrando só o que é de {ESPECIALIDADE_LABEL[filter as Especialidade]}. O diário e os
                alertas do paciente aparecem em “Todas as áreas”.
              </p>
            )}

            {visible.length === 0 ? (
              <EmptyState
                compact
                variant={filter === ALL ? "empty" : "search"}
                title={filter === ALL ? "Nada registrado neste período" : "Nada desta área neste período"}
                description={
                  days === null
                    ? "Quando houver diário, alertas, conversas, compromissos ou anotações, eles aparecem aqui."
                    : "Amplie o período para ver o que veio antes."
                }
                action={
                  days !== null ? (
                    <Button type="button" variant="outline" onClick={() => setDays(null)}>
                      Ver todo o histórico
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ol className="flex flex-col gap-4" aria-label="Linha do tempo do paciente">
                {visible.map((event) => (
                  <TimelineEvent key={`${event.kind}-${event.id}`} event={event} chatHref={chatHref} />
                ))}
              </ol>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default PatientRecordPanel;
