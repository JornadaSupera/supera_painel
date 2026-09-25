import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUsuariosStore } from "@/stores/usuarios";
import type { DistribuicaoEspecialidade } from "@/types/usuario";

/*
 * On a phone the seven cards used to stack into four rows and push the search
 * and the list ~450px down. There they become one row that scrolls sideways;
 * from `sm` up it is the grid again.
 */
const STRIP =
  "flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 lg:grid-cols-7";
const CARD = "w-36 shrink-0 sm:w-auto";

/**
 * Faixa com a contagem das sete especialidades, como no topo do protótipo.
 *
 * Cada cartão filtra a lista abaixo: a contagem que a pessoa está olhando é a
 * pergunta que ela quer fazer ("quais são os 3 enfermeiros?"), e obrigá-la a
 * repetir isso no filtro ao lado seria trabalho à toa.
 */
export function DistribuicaoEspecialidades({
  distribuicao,
  carregando,
}: {
  distribuicao: DistribuicaoEspecialidade[];
  carregando?: boolean;
}) {
  const filtro = useUsuariosStore((estado) => estado.filtros.especialidade);
  const setFiltro = useUsuariosStore((estado) => estado.setFiltro);

  if (carregando) {
    return (
      <div className={STRIP}>
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={cn("bg-card flex flex-col gap-2 rounded-xl border p-3", CARD)}>
            <Skeleton className="h-2 w-4/5" />
            <Skeleton className="h-5 w-8" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={STRIP}>
      {distribuicao.map((item) => {
        const ativo = filtro === item.especialidade;

        return (
          <button
            key={item.especialidade}
            type="button"
            // Clicar de novo no cartão ativo limpa o filtro — é o que se espera
            // de um botão que já está marcado.
            onClick={() => setFiltro("especialidade", ativo ? "" : item.especialidade)}
            aria-pressed={ativo}
            className={cn(
              "bg-card focus-visible:ring-ring/50 flex flex-col justify-between rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
              CARD,
              ativo ? "border-primary/40 bg-primary/5" : "hover:border-primary/30",
            )}
          >
            <p
              className={cn(
                // Two lines, not one: at 1024–1280 a single line cut "MÉDICO
                // ONCOLOGISTA" to "MÉDICO…". The count stays on the card
                // bottom, so the numbers still line up across the row.
                "line-clamp-2 text-[11px] leading-tight tracking-wider uppercase",
                ativo ? "text-primary" : "text-muted-foreground",
              )}
            >
              {item.label}
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums">{item.total}</p>
          </button>
        );
      })}
    </div>
  );
}

export default DistribuicaoEspecialidades;
