import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * Confirmação de ação sensível.
 *
 * Toda ação destrutiva do painel passa por aqui: desativar paciente, desativar
 * profissional, excluir conteúdo, exportar dados.
 *
 * Sobre `AlertDialog` (não `Dialog`): ele usa `role="alertdialog"` e **não
 * fecha por clique fora** — o gesto acidental é exatamente o que este diálogo
 * existe para impedir.
 */

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (dados: { motivo: string }) => void;
  titulo: string;
  descricao?: string;
  tone?: "danger" | "warning";
  confirmLabel?: string;
  cancelLabel?: string;
  /** Pede justificativa — o texto vai para a trilha de auditoria. */
  exigirMotivo?: boolean;
  loading?: boolean;
}

const MOTIVO_MINIMO = 5;

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  titulo,
  descricao,
  tone = "danger",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  exigirMotivo = false,
  loading = false,
}: ConfirmDialogProps) {
  const motivoId = useId();
  const [motivo, setMotivo] = useState("");

  // Limpa o motivo a cada abertura: justificativa de uma ação nunca deve
  // vazar para a próxima.
  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const motivoValido = !exigirMotivo || motivo.trim().length >= MOTIVO_MINIMO;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex gap-4">
            <span
              aria-hidden="true"
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                tone === "warning" ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger",
              )}
            >
              <TriangleAlert size={20} />
            </span>

            <div className="flex min-w-0 flex-col gap-2 text-left">
              <AlertDialogTitle>{titulo}</AlertDialogTitle>
              {descricao && <AlertDialogDescription>{descricao}</AlertDialogDescription>}
            </div>
          </div>
        </AlertDialogHeader>

        {exigirMotivo && (
          <div className="flex flex-col gap-2">
            <Label htmlFor={motivoId}>
              Motivo
              <span className="text-destructive" aria-hidden="true">
                *
              </span>
              <span className="sr-only">(obrigatório)</span>
            </Label>

            <Textarea
              id={motivoId}
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              maxLength={280}
              rows={3}
              placeholder="Descreva o motivo desta ação"
              aria-describedby={`${motivoId}-hint`}
            />

            <p id={`${motivoId}-hint`} className="text-muted-foreground text-xs">
              Registrado na trilha de auditoria. Mínimo de {MOTIVO_MINIMO} caracteres.
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>

          <AlertDialogAction
            disabled={!motivoValido || loading}
            onClick={(event) => {
              // Impede o fechamento automático quando a validação não passou.
              if (!motivoValido) {
                event.preventDefault();
                return;
              }
              onConfirm({ motivo: motivo.trim() });
            }}
            className={cn(
              tone === "danger" &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
