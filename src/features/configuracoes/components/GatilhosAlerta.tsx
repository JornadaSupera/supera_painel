import { BellRing } from "lucide-react";

import { EmptyState, ErrorState, Footnote, SkeletonCards, StatusBadge } from "@/components/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import type { RegraAlerta } from "@/types/configuracao";
import { useRegrasAlerta, useSalvarRegraAlerta } from "../hooks/useConfiguracoes";

/**
 * Gatilhos de criticidade — a partir de que grau um sintoma vira alerta.
 *
 * > [!] O painel não sugere limiar, e a omissão é a decisão.
 * Qual sintoma, em qual grau, exige conduta é julgamento clínico. Um valor
 * pré-preenchido seria o software opinando sobre gravidade — exatamente o que o
 * contrato veda a este produto. A tela oferece o cadastro e a lista começa
 * vazia.
 *
 * A consequência de estar vazia é dita em voz alta, porque ela não é óbvia:
 * enquanto nenhum sintoma tiver limiar, **nenhum alerta é criado**, e a fila de
 * alertas fica vazia por configuração e não por ausência de ocorrência. Uma fila
 * vazia que parece "está tudo bem" é o pior resultado possível desta tela.
 */

/** Graus que o diário aceita. Zero é "sem sintoma" e não dispara nada. */
const GRAUS = [1, 2, 3, 4, 5] as const;

const SEM_REGRA = "sem-regra";

function LinhaSintoma({
  regra,
  onChange,
  salvando,
}: {
  regra: RegraAlerta;
  onChange: (grau: number | null) => void;
  salvando: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-foreground truncate text-xs font-medium">{regra.sintoma_label}</p>

        <p className="text-muted-foreground truncate text-[11px]">
          {regra.grau_minimo === null
            ? "Não dispara alerta"
            : `Dispara a partir do grau ${regra.grau_minimo}${
                regra.vigente_desde ? ` · desde ${formatDate(regra.vigente_desde)}` : ""
              }`}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {regra.grau_minimo !== null && (
          <StatusBadge tone="warning" size="sm" dot>
            Ativo
          </StatusBadge>
        )}

        <Select
          value={regra.grau_minimo === null ? SEM_REGRA : String(regra.grau_minimo)}
          disabled={salvando}
          onValueChange={(valor) => onChange(valor === SEM_REGRA ? null : Number(valor))}
        >
          <SelectTrigger
            size="sm"
            className="w-36"
            aria-label={`Grau mínimo para ${regra.sintoma_label}`}
          >
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={SEM_REGRA}>Não dispara</SelectItem>
            {GRAUS.map((grau) => (
              <SelectItem key={grau} value={String(grau)}>
                Grau {grau} ou mais
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </li>
  );
}

export function GatilhosAlerta() {
  const regras = useRegrasAlerta();
  const salvar = useSalvarRegraAlerta();

  const linhas = regras.data ?? [];
  const comRegra = linhas.filter((regra) => regra.grau_minimo !== null).length;

  if (regras.isLoading) return <SkeletonCards count={2} />;

  if (regras.isError) {
    return <ErrorState error={regras.error} onRetry={() => void regras.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card rounded-2xl border p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-sm font-semibold">Gatilhos de criticidade</h2>
            <p className="text-muted-foreground text-xs">
              A partir de que grau um sintoma do diário vira alerta para a equipe
            </p>
          </div>

          <StatusBadge tone={comRegra > 0 ? "success" : "warning"} size="sm" dot className="shrink-0">
            {comRegra} de {linhas.length}
          </StatusBadge>
        </header>

        {linhas.length === 0 ? (
          <EmptyState compact title="Nenhum sintoma ativo no catálogo" />
        ) : (
          <ul className="divide-border divide-y">
            {linhas.map((regra) => (
              <LinhaSintoma
                key={regra.sintoma_id}
                regra={regra}
                salvando={salvar.isPending}
                onChange={(grau) =>
                  salvar.mutate({
                    sintoma_id: regra.sintoma_id,
                    sintoma_label: regra.sintoma_label,
                    grau_minimo: grau,
                  })
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* A consequência de a lista estar vazia não é óbvia, e é grave: a fila
          de alertas fica vazia por configuração, e vazio parece "tudo bem". */}
      {comRegra === 0 && linhas.length > 0 && (
        <div className="border-warning/30 bg-warning-bg text-warning-foreground flex gap-3 rounded-2xl border p-4">
          <BellRing size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium">Nenhum sintoma dispara alerta hoje</p>
            <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
              Enquanto nenhum grau estiver definido, nenhum alerta é criado — e a fila de alertas
              fica vazia por falta de regra, não por ausência de sintoma grave. Definir o limiar é
              decisão da equipe assistencial.
            </p>
          </div>
        </div>
      )}

      <Footnote>
        Trocar um limiar não reescreve o passado: os alertas já abertos continuam valendo pela regra
        sob a qual nasceram, e o histórico de cada limiar fica registrado. É o que permite explicar,
        meses depois, por que um sintoma disparou naquele dia.
      </Footnote>
    </div>
  );
}

export default GatilhosAlerta;
