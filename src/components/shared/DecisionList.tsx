import { formatDateTime } from "@/lib/format";

/**
 * A lista de decisões tomadas sobre algo, da mais recente para a mais antiga: o
 * que foi decidido, por quem, quando e com que comentário.
 *
 * Quem escreve a orientação lê o que o revisor disse; quem revisa lê o que já foi
 * dito antes. Os dois veem a mesma lista, do mesmo jeito.
 */
export interface Decision {
  id: string;
  /** "Devolvida · Fulana". */
  title: string;
  /** ISO 8601 UTC. */
  at: string;
  comment: string | null;
}

export function DecisionList({ decisions }: { decisions: Decision[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {decisions.map((decision) => (
        <li key={decision.id} className="bg-card rounded-xl border p-3 text-sm">
          <p className="text-xs font-medium">
            {decision.title}
            <span className="text-muted-foreground font-normal"> · {formatDateTime(decision.at)}</span>
          </p>
          {decision.comment && (
            <p className="text-muted-foreground mt-1 whitespace-pre-line">{decision.comment}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

export default DecisionList;
