import { Flag, Lock, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";

import { EmptyState, ErrorState, SectionHeading, SkeletonRows, SpecialtySeal } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ESPECIALIDADE,
  ESPECIALIDADE_LABEL,
  SPECIALTY_FIELD_LABEL,
  type Especialidade,
} from "@/lib/enums";
import type { PacienteDetalhe } from "@/types/paciente";
import type { PatientTimeline } from "@/types/patient-record";
import { usePatientTimeline } from "../hooks/usePatientRecord";
import { SpecialtyNoteForm } from "./SpecialtyNoteForm";
import { SpecialtySpace } from "./SpecialtySpace";
import { TimelineEvent } from "./TimelineEvent";

/**
 * The specialties tab of the patient record.
 *
 * A professional sees their own area only: its workspace (see `SpecialtySpace`),
 * what they can do there, and what the area has written and done. The rest of
 * the team's work is in the notes tab, filtered by area.
 *
 * The administration sees every area, one under the other, and writes in none.
 * Secrecy is the database's: a confidential area comes back to the
 * administration without its notes, conversations and appointments, and the
 * screen says why instead of drawing an empty list.
 *
 * Validated scales and the therapeutic plan are not here: the database has no
 * place for them yet, and this screen does not draw a block it cannot fill.
 */

const AREAS = Object.values(ESPECIALIDADE);

type Writing = "note" | "flag" | null;

interface AreaProps {
  specialty: Especialidade;
  patient: PacienteDetalhe;
  timeline: PatientTimeline;
  chatHref: string | null;
}

function ConfidentialNotice({ field }: { field: string }) {
  return (
    <div
      role="note"
      className="border-primary/40 bg-primary/5 flex items-start gap-3 rounded-xl border px-4 py-3"
    >
      <Lock size={18} aria-hidden="true" className="text-primary-ink mt-0.5 shrink-0" />
      <div className="flex flex-col gap-0.5">
        <p className="text-primary-ink text-sm font-semibold">
          Conteúdo sigiloso · visível somente à equipe de {field}
        </p>
        <p className="text-sm">
          Outros profissionais não veem o conteúdo das anotações. Eles recebem apenas a sinalização
          de sofrimento significativo, quando clinicamente relevante.
        </p>
      </div>
    </div>
  );
}

/**
 * What an area did with the patient: notes, flags, conversations and
 * appointments, newest first. Oncology has none of its own here — its space
 * already lists every source of the last 30 days, its notes included.
 */
function AreaRecords({
  specialty,
  timeline,
  chatHref,
  writing,
}: AreaProps & {
  /** Only in the professional's own area: the note button and its form. */
  writing?: { open: boolean; onOpen: () => void; form: ReactNode };
}) {
  const field = SPECIALTY_FIELD_LABEL[specialty];
  const confidential = timeline.confidential_specialties.includes(specialty);
  const events = timeline.events.filter((event) => event.specialty === specialty);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <SectionHeading>Registros de {field}</SectionHeading>
            <p className="text-muted-foreground text-xs">
              {confidential && writing
                ? "Anotações da área, sob sigilo, e o que mais a área fez com o paciente."
                : "Anotações, sinalizações, conversas e compromissos da área, do mais recente para trás."}
            </p>
          </div>

          {writing && !writing.open && (
            <Button type="button" onClick={writing.onOpen}>
              <Plus />
              Nova anotação
            </Button>
          )}
        </div>

        {writing?.open && writing.form}

        {events.length > 0 ? (
          <ol className="flex flex-col gap-4" aria-label={`Registros de ${field}`}>
            {events.map((event) => (
              <TimelineEvent key={`${event.kind}-${event.id}`} event={event} chatHref={chatHref} />
            ))}
          </ol>
        ) : writing ? (
          <EmptyState
            compact
            title={`Nada registrado por ${field}`}
            description="As anotações que você escrever aqui ficam na ficha, com seu nome e a data."
          />
        ) : (
          // Seven areas stack in the administration's view: one line each says
          // the same as a block would, without pushing the rest a screen down.
          <p className="text-muted-foreground text-sm">Nada registrado por {field}.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** The professional's own area: everything they can do with this patient. */
function OwnArea(props: AreaProps) {
  const { specialty, patient, timeline, chatHref } = props;
  const [writing, setWriting] = useState<Writing>(null);

  const field = SPECIALTY_FIELD_LABEL[specialty];
  const confidential = timeline.confidential_specialties.includes(specialty);
  const canFlag = specialty === ESPECIALIDADE.PSICOLOGO;
  const done = () => setWriting(null);

  return (
    <>
      {confidential && <ConfidentialNotice field={field} />}

      {/* Above the records, not after them as in the prototype: the list grows
          with every note, and the one act this area has for the team should
          not end up a page away. */}
      {canFlag && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex max-w-3xl flex-col gap-1">
                <h2 className="text-sm font-semibold">Sinalização à equipe</h2>
                <p className="text-muted-foreground text-xs">
                  Use esta função para avisar a equipe sobre sofrimento significativo. O conteúdo da
                  anotação NÃO é compartilhado: a equipe vê apenas que houve a sinalização, de qual
                  área e quando.
                </p>
              </div>

              {writing === null && (
                <Button type="button" variant="outline" onClick={() => setWriting("flag")}>
                  <Flag />
                  Sinalizar sofrimento
                </Button>
              )}
            </div>

            {writing === "flag" && (
              <SpecialtyNoteForm patientId={patient.id} specialty={specialty} flagByDefault onDone={done} />
            )}
          </CardContent>
        </Card>
      )}

      <SpecialtySpace specialty={specialty} own patient={patient} timeline={timeline} chatHref={chatHref} />

      {specialty !== ESPECIALIDADE.MEDICO && (
        <AreaRecords
          {...props}
          writing={{
            open: writing === "note",
            onOpen: () => setWriting("note"),
            form: <SpecialtyNoteForm patientId={patient.id} specialty={specialty} onDone={done} />,
          }}
        />
      )}
    </>
  );
}

/** One area in the administration's view: read only, and silent where secrecy withholds it. */
function ReadOnlyArea(props: AreaProps) {
  const { specialty, patient, timeline, chatHref } = props;
  const field = SPECIALTY_FIELD_LABEL[specialty];
  const withheld = timeline.confidential_specialties.includes(specialty);

  return (
    <section className="flex flex-col gap-3" aria-label={ESPECIALIDADE_LABEL[specialty]}>
      <div className="flex items-center gap-3 pt-2">
        <h2>
          <SpecialtySeal specialty={specialty} className="text-xs" />
        </h2>
        <span aria-hidden="true" className="bg-border h-px flex-1" />
      </div>

      {withheld ? (
        <Alert role="status">
          <Lock />
          <AlertTitle>Conteúdo sob sigilo profissional</AlertTitle>
          <AlertDescription>
            As anotações, conversas e compromissos de {field} ficam só com a própria área.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <SpecialtySpace
            specialty={specialty}
            own={false}
            patient={patient}
            timeline={timeline}
            chatHref={chatHref}
          />
          {specialty !== ESPECIALIDADE.MEDICO && <AreaRecords {...props} />}
        </>
      )}
    </section>
  );
}

export function SpecialtyRecordTab({
  patient,
  area,
  chatHref,
}: {
  patient: PacienteDetalhe;
  /** The professional's own specialty. `null` for the administration, which reads every area. */
  area: Especialidade | null;
  chatHref: string | null;
}) {
  // The whole history: an area's record is read as a whole, not by period.
  const timeline = usePatientTimeline(patient.id, null);

  if (timeline.isLoading) return <SkeletonRows count={3} />;

  if (timeline.isError || !timeline.data) {
    return <ErrorState error={timeline.error} onRetry={() => void timeline.refetch()} compact />;
  }

  const shared = { patient, timeline: timeline.data, chatHref };

  return (
    <div className="flex flex-col gap-4">
      {area ? (
        <OwnArea specialty={area} {...shared} />
      ) : (
        AREAS.map((specialty) => <ReadOnlyArea key={specialty} specialty={specialty} {...shared} />)
      )}
    </div>
  );
}

export default SpecialtyRecordTab;
