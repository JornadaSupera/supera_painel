import { ErrorState } from "@/components/shared";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import type { TransferTarget } from "@/types/conversation-transfer";
import { useTransferTargets } from "../hooks/useConversationTransfer";

/**
 * Choose a colleague — for forwarding a conversation and for handing over an
 * alert, which answer to the same question: to which active professional?
 *
 * It owns the four states the list can be in (loading, failed, empty, ready), so
 * neither dialog repeats them. Each dialog decides what to do with the choice.
 */

function describe(target: TransferTarget): string {
  const areas = target.specialties.map((specialty) => ESPECIALIDADE_LABEL[specialty]).join(", ");
  return areas ? `${target.name} · ${areas}` : target.name;
}

export function ColleagueSelect({
  id,
  label,
  emptyText,
  open,
  value,
  onChange,
  error,
  excluir = [],
}: {
  id: string;
  label: string;
  /** What to say when there is nobody to choose. */
  emptyText: string;
  /** The list is only read while the dialog that owns this is open. */
  open: boolean;
  value: string;
  onChange: (professionalId: string) => void;
  /** The form's message for a missing choice. */
  error?: string;
  /** Professionals not to offer — whoever already holds what is being handed over. */
  excluir?: readonly string[];
}) {
  const todos = useTransferTargets(open);
  const colleagues = {
    ...todos,
    data: todos.data?.filter((target) => !excluir.includes(target.professional_id)),
  };

  if (colleagues.isLoading) return <p className="text-muted-foreground text-sm">Carregando colegas…</p>;

  if (colleagues.isError) {
    return <ErrorState compact error={colleagues.error} onRetry={() => void colleagues.refetch()} />;
  }

  if (!colleagues.data || colleagues.data.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} <span className="text-destructive">*</span>
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full" aria-invalid={Boolean(error)}>
          <SelectValue placeholder="Escolha um colega" />
        </SelectTrigger>
        <SelectContent>
          {colleagues.data.map((target) => (
            <SelectItem key={target.professional_id} value={target.professional_id}>
              {describe(target)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

export default ColleagueSelect;
