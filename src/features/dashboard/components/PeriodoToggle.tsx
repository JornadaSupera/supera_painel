import { PERIODO_LABEL, type Periodo } from "@/lib/enums";
import { cn } from "@/lib/utils";

/**
 * Alternador de recorte temporal — diário, semanal e mensal (PDF §5).
 *
 * Implementado como grupo de rádio, não como abas: abas trocam *conteúdo*,
 * este controle troca o *recorte* do mesmo conteúdo. A diferença importa para
 * quem navega por leitor de tela.
 */

const ORDEM: Periodo[] = ["diario", "semanal", "mensal"];

export function PeriodoToggle({
  valor,
  onChange,
  className,
}: {
  valor: Periodo;
  onChange: (periodo: Periodo) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Recorte de período"
      className={cn("bg-muted inline-flex items-center gap-0.5 rounded-md p-0.5", className)}
    >
      {ORDEM.map((periodo) => {
        const ativo = periodo === valor;

        return (
          <button
            key={periodo}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(periodo)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors",
              ativo
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PERIODO_LABEL[periodo]}
          </button>
        );
      })}
    </div>
  );
}

export default PeriodoToggle;
