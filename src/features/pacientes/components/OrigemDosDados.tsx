import { DatabaseZap } from "lucide-react";

import { formatDate } from "@/lib/format";
import type { OrigemDoDado, PacienteDetalhe } from "@/types/paciente";

/**
 * De onde veio cada parte da ficha, numa tarja.
 *
 * > [!] Hoje tudo vale "digitado na clínica", e isso não torna a tarja inútil.
 * A integração com o sistema do consultório está desligada, então nenhuma ficha
 * veio de fora. Ela deixa de ser inerte no dia em que a sincronização ligar — e
 * é exatamente aí que alguém precisa da distinção: **corrigir no painel um
 * campo que a próxima sincronização sobrescreve é trabalho perdido**, e não há
 * como perceber isso olhando o valor.
 *
 * As três partes evoluem separadas porque vêm de lugares diferentes: a
 * identificação é da recepção, o histórico clínico é do atendimento, e o plano
 * terapêutico tem origem própria. Uma tarja só, dizendo "esta ficha veio do
 * Gemed", esconderia o caso comum — o de uma ficha meio importada, meio
 * digitada.
 */

const LABEL: Record<OrigemDoDado["origem"], string> = {
  local: "digitado na clínica",
  gemed: "sistema do consultório",
};

function Parte({ rotulo, dado }: { rotulo: string; dado: OrigemDoDado | null }) {
  // Sem plano terapêutico não há origem a declarar, e um "—" solto pareceria
  // dado faltando em vez de ausência legítima.
  if (!dado) return null;

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-muted-foreground">{rotulo}:</span>
      <span className="text-foreground font-medium">{LABEL[dado.origem]}</span>
      {dado.sincronizado_em && (
        <span className="text-muted-foreground tabular-nums">
          (em {formatDate(dado.sincronizado_em)})
        </span>
      )}
    </span>
  );
}

export function OrigemDosDados({ paciente }: { paciente: PacienteDetalhe }) {
  return (
    <div className="bg-muted/40 text-muted-foreground flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-3 py-2 text-[11px]">
      <span className="flex items-center gap-1.5 font-medium">
        <DatabaseZap size={13} aria-hidden="true" />
        Origem dos dados
      </span>

      <Parte rotulo="Cadastro" dado={paciente.origem_cadastro} />
      <Parte rotulo="Clínico" dado={paciente.origem_clinica} />
      <Parte rotulo="Plano" dado={paciente.origem_plano} />
    </div>
  );
}

export default OrigemDosDados;
