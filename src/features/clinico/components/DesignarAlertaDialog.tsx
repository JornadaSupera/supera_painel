import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AlertaClinico } from "@/types/clinico";
import { useDesignarAlerta } from "../hooks/useAlertasClinicos";
import { useTransferTargets } from "../hooks/useConversationTransfer";
import { assignAlertSchema, type AssignAlertForm } from "../schemas";
import { ColleagueSelect } from "./ColleagueSelect";

/**
 * Hand an alert that is being worked on to another professional.
 *
 * The candidates are the same colleagues a conversation can be forwarded to: any
 * active professional, of any area. Who receives it is told by a notification,
 * which the database sends.
 */
export function DesignarAlertaDialog({
  alerta,
  open,
  onOpenChange,
}: {
  alerta: AlertaClinico | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const colegas = useTransferTargets(open);
  const designar = useDesignarAlerta();

  const { handleSubmit, setValue, watch, reset, formState } = useForm<AssignAlertForm>({
    resolver: zodResolver(assignAlertSchema),
    defaultValues: { professionalId: "" },
  });

  // A choice made for one alert must not survive into the next.
  useEffect(() => {
    if (open) reset({ professionalId: "" });
  }, [open, alerta?.id, reset]);

  if (!alerta) return null;

  const escolhido = watch("professionalId");

  const enviar = handleSubmit((values) => {
    const colega = colegas.data?.find((item) => item.professional_id === values.professionalId);
    if (!colega) return;

    designar.mutate(
      { id: alerta.id, profissionalId: colega.professional_id, nome: colega.name },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Designar alerta · {alerta.paciente_nome}</DialogTitle>
            <DialogDescription>
              {alerta.sintoma_label}, grau {alerta.grau}. Quem receber é avisado por notificação e passa a
              cuidar do alerta.
            </DialogDescription>
          </DialogHeader>

          <ColleagueSelect
            id="assign-alert-target"
            label="Designar a"
            emptyText="Não há outro profissional ativo para receber o alerta."
            open={open}
            value={escolhido}
            onChange={(value) => setValue("professionalId", value, { shouldValidate: true })}
            error={formState.errors.professionalId?.message}
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={designar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={designar.isPending || !colegas.data?.length}>
              {designar.isPending ? "Designando…" : "Designar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DesignarAlertaDialog;
