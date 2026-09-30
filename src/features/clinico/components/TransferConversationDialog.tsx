import { zodResolver } from "@hookform/resolvers/zod";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

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
import type { ConversaClinico } from "@/types/clinico";
import { ColleagueSelect } from "./ColleagueSelect";
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

          <ColleagueSelect
            id="transfer-target"
            label="Encaminhar para"
            emptyText="Não há outro profissional ativo para receber a conversa."
            open={open}
            value={chosenId}
            onChange={(value) => setValue("professionalId", value, { shouldValidate: true })}
            error={formState.errors.professionalId?.message}
          />

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
