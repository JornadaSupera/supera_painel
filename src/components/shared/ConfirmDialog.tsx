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
 * Confirmation for a sensitive action.
 *
 * Every destructive action in the panel goes through here: deactivating a
 * patient, deactivating a professional, deleting content, exporting data.
 *
 * On `AlertDialog` (not `Dialog`): it uses `role="alertdialog"` and **does not
 * close on an outside click** — the accidental gesture is exactly what this
 * dialog exists to prevent.
 */

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: { reason: string }) => void;
  title: string;
  description?: string;
  tone?: "danger" | "warning";
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  /** Highlighted block under the description, for what must not be skimmed past. */
  notice?: string;
  /** Wording of the text field. The defaults describe an audit-trail reason. */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonHint?: string;
  /**
   * The text is not a justification but a note someone else will read, so it may
   * be left empty. `onConfirm` then receives an empty `reason`.
   */
  reasonOptional?: boolean;
  /** Non-blocking caution shown under the field while the typed text matches. */
  reasonCaution?: (text: string) => string | null;
}

const MIN_REASON_LENGTH = 5;

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  tone = "danger",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loading = false,
  notice,
  reasonLabel = "Motivo",
  reasonPlaceholder = "Descreva o motivo desta ação",
  reasonHint,
  reasonOptional = false,
  reasonCaution,
}: ConfirmDialogProps) {
  const reasonId = useId();
  const [reason, setReason] = useState("");

  // Clears the reason on every open: the justification for one action must
  // never leak into the next.
  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  const reasonIsValid = reasonOptional || reason.trim().length >= MIN_REASON_LENGTH;
  const caution = reasonCaution?.(reason) ?? null;

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
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
            </div>
          </div>
        </AlertDialogHeader>

        {notice && (
          <p
            role="alert"
            className={cn(
              "rounded-lg border p-3 text-sm leading-relaxed font-medium",
              tone === "warning"
                ? "border-warning/40 bg-warning-bg text-foreground"
                : "border-danger/40 bg-danger-bg text-foreground",
            )}
          >
            {notice}
          </p>
        )}

        {/* The justification is required unless the caller says the field is a
            note for someone else (`reasonOptional`). Only that opt-in can hand an
            empty string to `onConfirm`; the audit-trail uses never do. */}
        <div className="flex flex-col gap-2">
          <Label htmlFor={reasonId}>
            {reasonLabel}
            {reasonOptional ? (
              <span className="text-muted-foreground font-normal">(opcional)</span>
            ) : (
              <>
                <span className="text-destructive" aria-hidden="true">
                  *
                </span>
                <span className="sr-only">(obrigatório)</span>
              </>
            )}
          </Label>

          <Textarea
            id={reasonId}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={280}
            rows={3}
            placeholder={reasonPlaceholder}
            aria-describedby={`${reasonId}-hint`}
          />

          <p id={`${reasonId}-hint`} className="text-muted-foreground text-xs">
            {reasonHint ??
              `Registrado na trilha de auditoria. Mínimo de ${MIN_REASON_LENGTH} caracteres.`}
          </p>

          {caution && (
            <p role="status" className="text-warning text-xs font-medium">
              {caution}
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>

          <AlertDialogAction
            disabled={!reasonIsValid || loading}
            onClick={(event) => {
              // Blocks the automatic close when validation did not pass.
              if (!reasonIsValid) {
                event.preventDefault();
                return;
              }
              onConfirm({ reason: reason.trim() });
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
