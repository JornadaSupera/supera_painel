import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { DateInput, TimeInput } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PersonalBlock } from "@/types/agenda";
import { useDeleteBlock, useSaveBlock } from "../hooks/usePersonalAgenda";
import { blockFormToInput, blockSchema, blockToFormValues, type BlockForm } from "../schemas";

/**
 * Create, edit or remove a personal block.
 *
 * A block marks time as unavailable: nobody can book an appointment with the
 * professional inside it. It does not cancel an appointment that is already there
 * — saving says how many are — and the dialog tells that, instead of letting the
 * block read as having cleared the day.
 */
export function BlockDialog({
  open,
  onOpenChange,
  block,
  defaultDay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` creates. */
  block: PersonalBlock | null;
  /** The day a new block starts on. */
  defaultDay: string;
}) {
  const save = useSaveBlock();
  const remove = useDeleteBlock();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const { register, handleSubmit, setValue, watch, reset, control, formState } = useForm<BlockForm>({
    resolver: zodResolver(blockSchema),
    defaultValues: blockToFormValues(block, defaultDay),
  });

  // What was typed for one block must not survive into the next one.
  useEffect(() => {
    if (open) {
      reset(blockToFormValues(block, defaultDay));
      setConfirmingDelete(false);
    }
  }, [open, block, defaultDay, reset]);

  const allDay = watch("allDay");
  const busy = save.isPending || remove.isPending;
  const errors = formState.errors;

  const submit = handleSubmit((values) => {
    save.mutate({ id: block?.id, ...blockFormToInput(values) }, { onSuccess: () => onOpenChange(false) });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{block ? "Editar bloqueio" : "Bloquear horário"}</DialogTitle>
            <DialogDescription>
              Ninguém marca compromisso com você dentro deste período. Só você lê o motivo: quem agenda vê apenas
              que o horário está indisponível. Compromissos que já estão marcados continuam marcados.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-label">
              Motivo <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input id="block-label" placeholder="Almoço, congresso, férias…" {...register("label")} />
            {errors.label && (
              <p role="alert" className="text-destructive text-xs">
                {errors.label.message}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="block-all-day"
              checked={allDay}
              onCheckedChange={(checked) => setValue("allDay", checked === true, { shouldValidate: true })}
            />
            <Label htmlFor="block-all-day" className="font-normal">
              Dia inteiro
            </Label>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-end gap-x-3 gap-y-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-start-date">Início</Label>
              <Controller
                control={control}
                name="startDate"
                render={({ field }) => <DateInput id="block-start-date" {...field} />}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-start-time" className={allDay ? "text-muted-foreground" : undefined}>
                Hora
              </Label>
              <Controller
                control={control}
                name="startTime"
                render={({ field }) => (
                  <TimeInput id="block-start-time" className="w-24" disabled={allDay} {...field} />
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-end-date">Fim</Label>
              <Controller
                control={control}
                name="endDate"
                render={({ field }) => (
                  <DateInput id="block-end-date" aria-invalid={Boolean(errors.endDate)} {...field} />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-end-time" className={allDay ? "text-muted-foreground" : undefined}>
                Hora
              </Label>
              <Controller
                control={control}
                name="endTime"
                render={({ field }) => (
                  <TimeInput id="block-end-time" className="w-24" disabled={allDay} {...field} />
                )}
              />
            </div>
          </div>
          {(errors.endDate || errors.startDate) && (
            <p role="alert" className="text-destructive -mt-2 text-xs">
              {errors.endDate?.message ?? errors.startDate?.message}
            </p>
          )}

          <DialogFooter className="sm:justify-between">
            {block ? (
              confirmingDelete ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm whitespace-nowrap">Remover este bloqueio?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      remove.mutate(block.id, { onSuccess: () => onOpenChange(false) })
                    }
                  >
                    {remove.isPending ? "Removendo…" : "Remover"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                    Voltar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <Trash2 />
                  Remover
                </Button>
              )
            ) : (
              <span />
            )}

            {/* While the removal is being confirmed the footer belongs to the
                question: beside Cancelar/Salvar it wrapped onto three lines. */}
            {!confirmingDelete && (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy}>
                  {save.isPending && <LoaderCircle className="animate-spin" />}
                  {save.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </div>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default BlockDialog;
