import { Eye, Flag, Layers, Lock, Plus } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, SectionHeading, SkeletonRows } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ESPECIALIDADE,
  ESPECIALIDADE_LABEL,
  SPECIALTY_FIELD_LABEL,
  type Especialidade,
} from "@/lib/enums";
import type { PacienteDetalhe } from "@/types/paciente";
import { usePatientTimeline } from "../hooks/usePatientRecord";
import { SpecialtyNoteForm } from "./SpecialtyNoteForm";
import { SpecialtySpace } from "./SpecialtySpace";
import { TimelineEvent } from "./TimelineEvent";

/**
 * The record of one specialty — the multidisciplinary view, area by area.
 *
 * It opens on the professional's own area, and any other one can be picked. Each
 * area shows its own workspace (see `SpecialtySpace`) and then its records: notes,
 * distress flags, conversations and appointments. Secrecy is the database's: a
 * confidential area seen from outside comes back with its flags only, and the
 * screen says why.
 *
 * The administration reads it with no area of its own: it opens on Oncology,
 * nothing is "yours", and nothing is written.
 *
 * Validated scales and the therapeutic plan are not here: the database has no
 * place for them yet, and this screen does not draw a block it cannot fill.
 */

const AREAS = Object.values(ESPECIALIDADE);

type Writing = "note" | "flag" | null;

/** Said every time the record on screen is not the viewer's own area. */
function OtherAreaNotice({ area }: { area: Especialidade }) {
  return (
    <p
      role="status"
      className="bg-muted/50 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm"
    >
      <Eye size={16} aria-hidden="true" className="text-muted-foreground shrink-0" />
      <span>
        Você está visualizando a ficha de outra especialidade. Sua área é{" "}
        <strong>{ESPECIALIDADE_LABEL[area]}</strong>.
      </span>
    </p>
  );
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

export function SpecialtyRecordTab({
  patient,
  area,
  chatHref,
}: {
  patient: PacienteDetalhe;
  /**
   * The professional's own specialty: where the view opens, and the only one they
   * write in. `null` for the administration, which only reads.
   */
  area: Especialidade | null;
  chatHref: string | null;
}) {
  const [selected, setSelected] = useState<Especialidade>(area ?? ESPECIALIDADE.MEDICO);
  const [writing, setWriting] = useState<Writing>(null);

  // The whole history: an area's record is read as a whole, not by period.
  const patientId = patient.id;
  const timeline = usePatientTimeline(patientId, null);

  const own = area !== null && selected === area;
  const field = SPECIALTY_FIELD_LABEL[selected];
  const confidential = (timeline.data?.confidential_specialties ?? []).includes(selected);
  const events = (timeline.data?.events ?? []).filter((event) => event.specialty === selected);
  const canFlag = own && area === ESPECIALIDADE.PSICOLOGO;

  return (
    <div className="flex flex-col gap-4">
      <Card className="py-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden="true"
              className="bg-muted text-primary-ink flex size-9 shrink-0 items-center justify-center rounded-lg"
            >
              <Layers size={18} />
            </span>
            <div className="flex min-w-0 flex-col">
              <h2 className="text-sm font-semibold">Ficha por especialidade</h2>
              <p className="text-muted-foreground text-xs">
                Visão multidisciplinar — abra a ficha de qualquer especialidade da equipe.
              </p>
            </div>
          </div>

          <Select
            value={selected}
            onValueChange={(value) => {
              setSelected(value as Especialidade);
              setWriting(null);
            }}
          >
            <SelectTrigger className="w-64" aria-label="Especialidade">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AREAS.map((option) => (
                <SelectItem key={option} value={option}>
                  {ESPECIALIDADE_LABEL[option]}
                  {option === area && " · sua área"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {area && !own && <OtherAreaNotice area={area} />}

      {timeline.isLoading && <SkeletonRows count={3} />}

      {timeline.isError && (
        <ErrorState error={timeline.error} onRetry={() => void timeline.refetch()} compact />
      )}

      {timeline.data && (
        <>
          {confidential && own && <ConfidentialNotice field={field} />}

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
                  <SpecialtyNoteForm
                    patientId={patientId}
                    specialty={selected}
                    flagByDefault
                    onDone={() => setWriting(null)}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {confidential && !own && (
            <Alert role="status">
              <Lock />
              <AlertTitle>Conteúdo sob sigilo profissional</AlertTitle>
              <AlertDescription>
                As anotações, conversas e compromissos de {field} ficam só com a própria área. Você vê
                apenas as sinalizações, que são para toda a equipe.
              </AlertDescription>
            </Alert>
          )}

          <SpecialtySpace
            specialty={selected}
            own={own}
            patient={patient}
            timeline={timeline.data}
            chatHref={chatHref}
          />

          {/* Oncology's space already lists every source of the last 30 days, its
              own notes included, and writes from there. */}
          {selected !== ESPECIALIDADE.MEDICO && (
            <Card>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5">
                    <SectionHeading>Registros de {field}</SectionHeading>
                    <p className="text-muted-foreground text-xs">
                      {confidential && own
                        ? "Anotações da área, sob sigilo, e o que mais a área fez com o paciente."
                        : "Anotações, sinalizações, conversas e compromissos da área, do mais recente para trás."}
                    </p>
                  </div>

                  {own && writing === null && (
                    <Button type="button" variant="outline" onClick={() => setWriting("note")}>
                      <Plus />
                      Nova anotação
                    </Button>
                  )}
                </div>

                {writing === "note" && (
                  <SpecialtyNoteForm patientId={patientId} specialty={selected} onDone={() => setWriting(null)} />
                )}

                {events.length === 0 ? (
                  <EmptyState
                    compact
                    title={`Nada registrado por ${field}`}
                    description={
                      own
                        ? "As anotações que você escrever aqui ficam na ficha, com seu nome e a data."
                        : "Quando a área registrar algo com este paciente, aparece aqui."
                    }
                  />
                ) : (
                  <ol className="flex flex-col gap-4" aria-label={`Registros de ${field}`}>
                    {events.map((event) => (
                      <TimelineEvent key={`${event.kind}-${event.id}`} event={event} chatHref={chatHref} />
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

export default SpecialtyRecordTab;
