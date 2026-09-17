import { RotateCw, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * A SUPPORTING SOURCE THAT FAILED TO LOAD.
 * =============================================================================
 * A select fed by `data ?? []` turns a backend failure into an empty list, and
 * an empty list reads as a legitimate answer: "there are no diagnoses
 * registered". Nobody retries something that looks complete, and a form filled
 * against a vocabulary that failed to load is filled wrong.
 *
 * So the failure is stated where the control would be, with a way out.
 *
 * Two components instead of one with a `variant`: a chip sitting in a filter bar
 * and an alert sitting above a form are different shapes with different jobs,
 * and a shared prop set would only be a place for impossible combinations to
 * live.
 */

export interface SourceErrorProps {
  /**
   * What failed to load, in the user's words and in the accusative — the copy
   * reads "Não foi possível carregar {label}".
   *
   * "a lista de CIDs", not "cids" and not "useCids": whoever reads this is
   * deciding whether to retry or to call someone, and needs the name of the
   * thing, not of the hook.
   */
  label: string;
  onRetry?: () => void;
}

/** Sits in a filter bar, where the select would have been. */
export function SourceErrorChip({ label, onRetry }: SourceErrorProps) {
  return (
    <span
      role="alert"
      className="border-danger/30 bg-danger-bg text-danger flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs"
    >
      <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{label} não carregou</span>

      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="text-danger hover:text-danger h-auto px-1 py-0 text-xs underline"
        >
          Tentar de novo
        </Button>
      )}
    </span>
  );
}

/**
 * Sits above a form whose submission depends on the source.
 *
 * Use it together with disabling the submit button: telling someone a
 * vocabulary is missing and still accepting the form would save a record
 * against a field they could not fill.
 */
export function SourceErrorAlert({ label, onRetry }: SourceErrorProps) {
  return (
    <Alert variant="destructive" role="alert">
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>Não foi possível carregar {label}</AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        <span>
          O cadastro depende dessa lista, então o salvamento fica bloqueado até ela carregar —
          gravar uma ficha sem ela deixaria o campo errado, não vazio.
        </span>

        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw />
            Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
