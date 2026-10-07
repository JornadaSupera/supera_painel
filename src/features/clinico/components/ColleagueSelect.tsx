import { ErrorState } from "@/components/shared";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ESPECIALIDADE_LABEL, type Especialidade } from "@/lib/enums";
import type { TransferTarget } from "@/types/conversation-transfer";
import { useTransferTargets } from "../hooks/useConversationTransfer";

/**
 * Choose a colleague — for forwarding a conversation and for handing over an
 * alert, which answer to the same question: to which active professional?
 *
 * It owns the four states the list can be in (loading, failed, empty, ready), so
 * neither dialog repeats them. Each dialog decides what to do with the choice.
 */

const AREA_ORDER = Object.keys(ESPECIALIDADE_LABEL) as Especialidade[];

/**
 * Colleagues by area, in the order the areas are listed everywhere else: who to
 * hand something to is first a question of which area. A colleague with two
 * areas sits under the main one, and the second is named beside them.
 */
function byArea(
  targets: TransferTarget[],
): { area: Especialidade | null; targets: TransferTarget[] }[] {
  const groups = new Map<Especialidade | null, TransferTarget[]>();
  for (const target of targets) {
    const area = target.specialties[0] ?? null;
    groups.set(area, [...(groups.get(area) ?? []), target]);
  }

  return [...AREA_ORDER, null]
    .filter((area) => groups.has(area))
    .map((area) => ({
      area,
      targets: (groups.get(area) ?? []).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    }));
}

function describe(target: TransferTarget): string {
  const others = target.specialties.slice(1).map((specialty) => ESPECIALIDADE_LABEL[specialty]);
  return others.length > 0 ? `${target.name} · também ${others.join(", ")}` : target.name;
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
          {byArea(colleagues.data).map((group) => (
            <SelectGroup key={group.area ?? "sem-area"}>
              <SelectLabel>{group.area ? ESPECIALIDADE_LABEL[group.area] : "Sem área"}</SelectLabel>
              {group.targets.map((target) => (
                <SelectItem key={target.professional_id} value={target.professional_id}>
                  {describe(target)}
                </SelectItem>
              ))}
            </SelectGroup>
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
