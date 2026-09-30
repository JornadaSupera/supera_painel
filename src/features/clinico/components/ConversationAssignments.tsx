import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ESPECIALIDADE_LABEL } from "@/lib/enums";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useConversationAssignments } from "../hooks/useConversationTransfer";

/**
 * Who held the conversation, and when — the visible trace of a transfer.
 *
 * Closed by default: it is one audited read, and most conversations never changed
 * hands. The row still open is the person holding it now.
 */
export function ConversationAssignments({ conversationId }: { conversationId: string }) {
  const [open, setOpen] = useState(false);
  const assignments = useConversationAssignments(conversationId, open);

  return (
    <div className="border-border border-b px-4 py-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        Histórico de atribuição
      </Button>

      {open && assignments.isLoading && (
        <p className="text-muted-foreground py-1 text-xs" role="status">
          Carregando…
        </p>
      )}
      {open && assignments.isError && (
        <p className="text-destructive py-1 text-xs" role="alert">
          Não foi possível carregar o histórico.{" "}
          <button type="button" className="underline" onClick={() => void assignments.refetch()}>
            Tentar de novo
          </button>
        </p>
      )}
      {open && assignments.data && assignments.data.length === 0 && (
        <p className="text-muted-foreground py-1 text-xs">Ninguém assumiu esta conversa ainda.</p>
      )}
      {open && assignments.data && assignments.data.length > 0 && (
        <ol className="flex flex-col gap-1.5 py-1" aria-label="Histórico de atribuição da conversa">
          {assignments.data.map((assignment) => (
            <li key={assignment.id} className="text-xs">
              <span className="font-medium">{assignment.professional_name}</span>
              {assignment.specialty && (
                <span className="text-muted-foreground">
                  {" "}
                  · {ESPECIALIDADE_LABEL[assignment.specialty]}
                </span>
              )}
              <span className="text-muted-foreground">
                {" "}
                · desde {formatDateTime(assignment.assigned_at)}
                {assignment.released_at
                  ? ` até ${formatDateTime(assignment.released_at)}`
                  : " · com esta pessoa agora"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default ConversationAssignments;
