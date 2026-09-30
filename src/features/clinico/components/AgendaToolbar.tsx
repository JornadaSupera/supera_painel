import { ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AGENDA_VIEW, AGENDA_VIEW_LABEL, viewTitle, type AgendaView } from "@/lib/agenda";
import { cn } from "@/lib/utils";
import type { AppointmentTypeOption } from "@/types/agenda";

/** The value of "no filter": a Select item cannot carry an empty string. */
export const ALL_TYPES = "todos";

const VIEWS: AgendaView[] = [AGENDA_VIEW.MONTH, AGENDA_VIEW.WEEK, AGENDA_VIEW.DAY];

/**
 * What the agenda is showing and how to change it: the view, the period, the
 * kind of appointment and the entry point for blocking time.
 *
 * The view is a set of buttons with `aria-pressed`, not tabs: nothing here is a
 * panel that swaps, it is the same calendar drawn three ways.
 */
export function AgendaToolbar({
  view,
  day,
  onViewChange,
  onStep,
  onToday,
  type,
  types,
  onTypeChange,
  onNewBlock,
}: {
  view: AgendaView;
  day: string;
  onViewChange: (view: AgendaView) => void;
  onStep: (direction: 1 | -1) => void;
  onToday: () => void;
  type: string;
  types: AppointmentTypeOption[];
  onTypeChange: (type: string) => void;
  onNewBlock: () => void;
}) {
  const period = { mes: "mês", semana: "semana", dia: "dia" }[view];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" aria-label={`Ver ${period} anterior`} onClick={() => onStep(-1)}>
            <ChevronLeft />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label={`Ver próximo ${period}`} onClick={() => onStep(1)}>
            <ChevronRight />
          </Button>
          <Button type="button" variant="outline" onClick={onToday}>
            Hoje
          </Button>
          <h2 className="ml-2 text-base font-semibold first-letter:uppercase" aria-live="polite">
            {viewTitle(view, day)}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Visão da agenda" className="bg-muted inline-flex rounded-lg p-[3px]">
            {VIEWS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => onViewChange(option)}
                className={cn(
                  "focus-visible:ring-ring rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  view === option
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {AGENDA_VIEW_LABEL[option]}
              </button>
            ))}
          </div>

          <Button type="button" onClick={onNewBlock}>
            <LockKeyhole />
            Bloquear horário
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label htmlFor="agenda-type" className="text-xs">
          Tipo
        </Label>
        <Select value={type} onValueChange={onTypeChange}>
          <SelectTrigger id="agenda-type" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>Todos os tipos</SelectItem>
            {types.map((option) => (
              <SelectItem key={option.id} value={option.label}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default AgendaToolbar;
