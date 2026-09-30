import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ESPECIALIDADE, ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import { SPECIALTY_NOTE_MAX } from "@/lib/patient-record";
import { noteWasSaved, useAddSpecialtyNote } from "../hooks/usePatientRecord";
import { specialtyNoteSchema, type SpecialtyNoteForm } from "../schemas";

/**
 * A point note, written in the professional's own area.
 *
 * It is free text and it is not an official evolution — the formal one stays in
 * the hospital's system. Once saved it cannot be edited or deleted (correcting is
 * writing another), which is why the button says "Salvar" and the text under the
 * field says so before, not after.
 *
 * Psychology can flag distress in the same step. The flag carries no text: the
 * rest of the team learns that something happened, never what was said.
 */
export function SpecialtyNoteForm({
  patientId,
  specialty,
  onDone,
}: {
  patientId: string;
  specialty: Especialidade;
  onDone: () => void;
}) {
  const add = useAddSpecialtyNote(patientId);
  const canFlag = specialty === ESPECIALIDADE.PSICOLOGO;

  const form = useForm<SpecialtyNoteForm>({
    resolver: zodResolver(specialtyNoteSchema),
    defaultValues: { body: "", flagDistress: false },
  });
  const { register, handleSubmit, setValue, watch, reset, formState } = form;

  const length = watch("body").length;
  const flag = watch("flagDistress");

  const submit = handleSubmit((values) => {
    add.mutate(
      { specialty, body: values.body, flagDistress: values.flagDistress },
      {
        onSuccess: () => {
          reset();
          onDone();
        },
        // The note went out and only the flag failed: keeping the text would
        // invite saving the same note twice, and the database keeps both.
        onError: (error) => {
          if (noteWasSaved(error)) {
            reset();
            onDone();
          }
        },
      },
    );
  });

  return (
    <form onSubmit={submit} className="bg-muted/40 flex flex-col gap-3 rounded-xl border p-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="specialty-note-body">Anotação · {ESPECIALIDADE_LABEL[specialty]}</Label>
        <Textarea
          id="specialty-note-body"
          rows={4}
          placeholder="O que foi observado ou combinado neste atendimento."
          aria-invalid={Boolean(formState.errors.body)}
          aria-describedby="specialty-note-hint"
          {...register("body")}
        />
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p id="specialty-note-hint" className="text-muted-foreground text-xs">
            Anotação pontual, sem caráter de evolução oficial. Depois de salva ela não se edita: para
            corrigir, escreva outra.
          </p>
          <span
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
            aria-live="polite"
          >
            {length}/{SPECIALTY_NOTE_MAX}
          </span>
        </div>
        {formState.errors.body && (
          <p role="alert" className="text-destructive text-xs">
            {formState.errors.body.message}
          </p>
        )}
      </div>

      {canFlag && (
        <div className="flex items-start gap-2">
          <Checkbox
            id="specialty-note-flag"
            checked={flag}
            onCheckedChange={(checked) => setValue("flagDistress", checked === true)}
          />
          <div className="flex flex-col gap-0.5">
            <Label htmlFor="specialty-note-flag" className="font-medium">
              Sinalizar sofrimento à equipe
            </Label>
            <p className="text-muted-foreground text-xs">
              A equipe vê que houve a sinalização, de qual área e quando. O texto desta anotação
              continua só com a Psicologia.
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={add.isPending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={add.isPending}>
          {add.isPending && <LoaderCircle className="animate-spin" />}
          {add.isPending ? "Salvando…" : "Salvar anotação"}
        </Button>
      </div>
    </form>
  );
}

export default SpecialtyNoteForm;
