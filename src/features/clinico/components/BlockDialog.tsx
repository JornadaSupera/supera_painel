import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

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
 * A block marks time as unavailable for the professional. It does not cancel an
 * appointment that is already there, and the scheduling side does not consult it
 * yet — the dialog says so, instead of letting the block read as a guarantee.
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

  const { register, handleSubmit, setValue, watch, reset, formState } = useForm<BlockForm>({
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
              O bloqueio marca o período como indisponível na sua agenda. Só você o vê, e ele não cancela
              compromissos que já estão marcados.
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
              <Input id="block-start-date" type="date" {...register("startDate")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-start-time" className={allDay ? "text-muted-foreground" : undefined}>
                Hora
              </Label>
              <Input id="block-start-time" type="time" disabled={allDay} {...register("startTime")} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-end-date">Fim</Label>
              <Input
                id="block-end-date"
                type="date"
                aria-invalid={Boolean(errors.endDate)}
                {...register("endDate")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-end-time" className={allDay ? "text-muted-foreground" : undefined}>
                Hora
              </Label>
              <Input id="block-end-time" type="time" disabled={allDay} {...register("endTime")} />
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
