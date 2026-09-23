import { Check, Link2, X } from "lucide-react";

import { EmptyState, ErrorState, SkeletonCards, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { VinculoExterno } from "@/types/configuracao";
import { useConfirmarVinculo, useVinculosExternos } from "../hooks/useConfiguracoes";

/**
 * A conferência humana dos vínculos propostos pela integração.
 *
 * > [!] Esta tela existe para impedir o pior erro possível do sistema.
 * Ligar a ficha errada ao paciente errado **mistura prontuários**: a partir
 * daí o diário de uma pessoa aparece na ficha de outra, e o erro só aparece
 * quando alguém estranha um dado que não bate. Por isso nada do sistema de
 * origem entra numa ficha antes de um humano confirmar o par.
 *
 * > [!] Ela está vazia hoje, e é construída assim de propósito.
 * A sincronização não está ligada, então nenhum vínculo foi proposto. Construir
 * a conferência no dia em que os vínculos começarem a chegar é construí-la com
 * pressa — e com a fila já cheia de decisões esperando.
 */

/** O que o vínculo aponta. O tipo vem cru do backend e é polimórfico. */
const ENTIDADE_LABEL: Record<string, string> = {
  patient: "Ficha de paciente",
  treatment_plan: "Plano terapêutico",
  patient_diagnosis: "Diagnóstico",
};

function Linha({
  vinculo,
  onDecidir,
  decidindo,
}: {
  vinculo: VinculoExterno;
  onDecidir: (confirmar: boolean) => void;
  decidindo: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-foreground text-xs font-medium">
          {ENTIDADE_LABEL[vinculo.entidade] ?? vinculo.entidade}
        </p>

        <p className="text-muted-foreground mt-0.5 font-mono text-[11px] break-all">
          {vinculo.chave_externa}
        </p>

        <p className="text-muted-foreground mt-0.5 text-[11px]">
          {vinculo.sistema} · proposto em {formatDateTime(vinculo.proposto_em)}
        </p>
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={decidindo}
          onClick={() => onDecidir(false)}
          className="text-destructive hover:text-destructive"
        >
          <X />
          Rejeitar
        </Button>

        <Button size="sm" disabled={decidindo} onClick={() => onDecidir(true)}>
          <Check />
          Confirmar
        </Button>
      </div>
    </li>
  );
}

export function FilaDeConferencia() {
  const { vinculos, isLoading, isError, error, refetch } = useVinculosExternos();
  const decidir = useConfirmarVinculo();

  if (isLoading) return <SkeletonCards count={1} />;

  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card rounded-2xl border p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-sm font-semibold">Vínculos a conferir</h2>
            <p className="text-muted-foreground text-xs">
              Pares propostos pelo sistema do consultório, esperando confirmação humana
            </p>
          </div>

          <StatusBadge
            tone={vinculos.length > 0 ? "warning" : "neutral"}
            size="sm"
            dot={vinculos.length > 0}
            className="shrink-0"
          >
            <Link2 size={10} aria-hidden="true" className="mr-1" />
            {vinculos.length} na fila
          </StatusBadge>
        </header>

        {vinculos.length === 0 ? (
          <EmptyState
            compact
            title="Nada a conferir"
            description="A sincronização com o sistema do consultório não está ligada, então nenhum vínculo foi proposto. Quando ela ligar, cada par aparece aqui antes de qualquer dado entrar numa ficha."
          />
        ) : (
          <ul className="divide-border divide-y">
            {vinculos.map((vinculo) => (
              <Linha
                key={vinculo.id}
                vinculo={vinculo}
                decidindo={decidir.isPending}
                onDecidir={(confirmar) => decidir.mutate({ id: vinculo.id, confirmar })}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Confirmar libera o sistema de origem a preencher aquela ficha; rejeitar registra a recusa e
        mantém a ficha intocada. Nos dois casos a linha sai da fila com a decisão gravada — quem
        decidiu e quando.
      </p>
    </div>
  );
}

export default FilaDeConferencia;
