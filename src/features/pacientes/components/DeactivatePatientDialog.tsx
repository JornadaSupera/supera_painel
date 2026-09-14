import { ConfirmDialog } from "@/components/shared";
import { useDesativarPaciente } from "../hooks/usePacientes";

export interface DeactivatePatientDialogProps {
  paciente: { id: string; nome: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after the deactivation succeeds — the record page leaves to the list. */
  onDeactivated?: () => void;
}

/**
 * Logical deactivation, always with a reason — it is what the audit trail shows
 * afterwards. Same dialog from the list actions and from the record page.
 */
export function DeactivatePatientDialog({
  paciente,
  open,
  onOpenChange,
  onDeactivated,
}: DeactivatePatientDialogProps) {
  const desativar = useDesativarPaciente();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Desativar ${paciente.nome}?`}
      description="A ficha continua no sistema e o histórico é preservado, mas o paciente deixa de aparecer como ativo e perde o acesso ao aplicativo."
      confirmLabel="Desativar"
      requireReason
      loading={desativar.isPending}
      onConfirm={({ reason }) => {
        desativar.mutate({ id: paciente.id, motivo: reason }, { onSuccess: onDeactivated });
        onOpenChange(false);
      }}
    />
  );
}
