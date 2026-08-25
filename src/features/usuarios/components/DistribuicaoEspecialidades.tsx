import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUsuariosStore } from "@/stores/usuarios";
import type { DistribuicaoEspecialidade } from "@/types/usuario";

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
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="bg-card flex flex-col gap-2 rounded-xl border p-3">
            <Skeleton className="h-2 w-4/5" />
            <Skeleton className="h-5 w-8" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
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
              "bg-card focus-visible:ring-ring/50 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
              ativo ? "border-primary/40 bg-primary/5" : "hover:border-primary/30",
            )}
          >
            <p
              className={cn(
                "line-clamp-1 text-[10px] tracking-wider uppercase",
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
