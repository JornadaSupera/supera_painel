import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { ErrorState } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import type { ConversaClinico } from "@/types/clinico";
import type { TransferTarget } from "@/types/conversation-transfer";
import { useTransferConversation, useTransferTargets } from "../hooks/useConversationTransfer";
import { transferConversationSchema, type TransferConversationForm } from "../schemas";

/**
 * Choose the colleague who takes over a conversation.
 *
 * The person is chosen, not the area: the database sends the conversation to the
 * area that colleague works in. What the patient reads afterwards is a generic
 * message written by the database, so the dialog says what will happen without
 * promising a wording.
 */

function describe(target: TransferTarget): string {
  const areas = target.specialties.map((specialty) => ESPECIALIDADE_LABEL[specialty]).join(", ");
  return areas ? `${target.name} · ${areas}` : target.name;
}

export function TransferConversationDialog({
  conversation,
  open,
  onOpenChange,
}: {
  conversation: ConversaClinico;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const targets = useTransferTargets(open);
  const transfer = useTransferConversation();

  const { handleSubmit, setValue, watch, reset, formState } = useForm<TransferConversationForm>({
    resolver: zodResolver(transferConversationSchema),
    defaultValues: { professionalId: "" },
  });

  // A choice made for one conversation must not survive into the next.
  useEffect(() => {
    if (open) reset({ professionalId: "" });
  }, [open, conversation.id, reset]);

  const chosenId = watch("professionalId");
  const chosen = targets.data?.find((target) => target.professional_id === chosenId);

  const submit = handleSubmit((values) => {
    const target = targets.data?.find((item) => item.professional_id === values.professionalId);
    if (!target) return;

    transfer.mutate(
      { conversationId: conversation.id, toProfessionalId: target.professional_id, toName: target.name },
      { onSuccess: () => onOpenChange(false) },
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Encaminhar conversa · {conversation.paciente_nome}</DialogTitle>
            <DialogDescription>
              A conversa passa para o colega escolhido e deixa a sua fila. O paciente recebe um aviso
              de que foi encaminhado para outro profissional da equipe, sem nomes.
            </DialogDescription>
          </DialogHeader>

          {targets.isLoading && <p className="text-muted-foreground text-sm">Carregando colegas…</p>}
          {targets.isError && (
            <ErrorState compact error={targets.error} onRetry={() => void targets.refetch()} />
          )}
          {targets.data && targets.data.length === 0 && (
            <p className="text-muted-foreground text-sm">
              Não há outro profissional ativo para receber a conversa.
            </p>
          )}

          {targets.data && targets.data.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transfer-target">
                Encaminhar para <span className="text-destructive">*</span>
              </Label>
              <Select
                value={chosenId}
                onValueChange={(value) => setValue("professionalId", value, { shouldValidate: true })}
              >
                <SelectTrigger
                  id="transfer-target"
                  className="w-full"
                  aria-invalid={Boolean(formState.errors.professionalId)}
                >
                  <SelectValue placeholder="Escolha um colega" />
                </SelectTrigger>
                <SelectContent>
                  {targets.data.map((target) => (
                    <SelectItem key={target.professional_id} value={target.professional_id}>
                      {describe(target)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formState.errors.professionalId && (
                <p role="alert" className="text-destructive text-xs">
                  {formState.errors.professionalId.message}
                </p>
              )}
            </div>
          )}

          {chosen?.changed_area && (
            <Alert role="status">
              <TriangleAlert />
              <AlertTitle>{chosen.name} mudou de área</AlertTitle>
              <AlertDescription>
                O sistema escolhe a área de destino entre todos os registros da pessoa, inclusive a área
                que ela deixou. A conversa pode cair nessa área antiga, onde {chosen.name} não a vê.
                Prefira um colega que sempre atuou na mesma área.
              </AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={transfer.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={transfer.isPending || !targets.data?.length}>
              {transfer.isPending ? "Encaminhando…" : "Encaminhar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default TransferConversationDialog;
