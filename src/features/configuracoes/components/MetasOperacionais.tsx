import { useEffect, useState } from "react";

import { Target } from "lucide-react";

import { ErrorState, Footnote, SkeletonCards } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMetasOperacionais, useSalvarMetaOperacional } from "../hooks/useConfiguracoes";

/**
 * Metas e capacidade — as linhas de referência do gráfico de volume, em
 * Estatísticas operacionais.
 *
 * `operational_parameters` não nasce com estes dois códigos: a tabela existe
 * desde 25/09/2026, vazia, e cada linha só passa a existir quando salva aqui
 * pela primeira vez. Até lá, o campo mostra vazio, não zero — zero se leria
 * como uma meta real de "zero atendimentos por mês".
 */

const METAS_FIXAS = [
  {
    codigo: "monthly_appointments_target",
    rotulo: "Meta mensal",
    descricao: "Quantos compromissos a clínica pretende realizar por mês",
  },
  {
    codigo: "monthly_appointments_capacity",
    rotulo: "Capacidade máxima",
    descricao: "O teto de compromissos que a agenda comporta por mês",
  },
] as const;

function CampoMeta({
  codigo,
  rotulo,
  descricao,
  valorAtual,
  onSalvar,
  salvando,
}: {
  codigo: string;
  rotulo: string;
  descricao: string;
  valorAtual: number | null;
  onSalvar: (valor: number) => void;
  salvando: boolean;
}) {
  const [texto, setTexto] = useState(valorAtual === null ? "" : String(valorAtual));

  // Sincroniza quando a leitura chega ou quando a mutação confirma um valor
  // novo — nunca a cada tecla, ou o campo perderia o que a pessoa digita.
  useEffect(() => {
    setTexto(valorAtual === null ? "" : String(valorAtual));
  }, [valorAtual]);

  const numero = Number(texto);
  const valido = texto.trim() !== "" && Number.isFinite(numero) && numero >= 0;
  const mudou = texto.trim() !== (valorAtual === null ? "" : String(valorAtual));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`meta-${codigo}`} className="text-xs">
        {rotulo}
      </Label>

      <div className="flex items-center gap-2">
        <Input
          id={`meta-${codigo}`}
          type="number"
          min={0}
          inputMode="numeric"
          value={texto}
          placeholder="Ainda não cadastrada"
          aria-invalid={texto.trim() !== "" && !valido}
          className="w-36 font-mono"
          onChange={(evento) => setTexto(evento.target.value)}
        />

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!valido || !mudou || salvando}
          onClick={() => onSalvar(numero)}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <p className="text-muted-foreground text-[11px]">{descricao}</p>
    </div>
  );
}

export function MetasOperacionais() {
  const metas = useMetasOperacionais();
  const salvar = useSalvarMetaOperacional();

  if (metas.isLoading) return <SkeletonCards count={1} />;
  if (metas.isError) return <ErrorState error={metas.error} onRetry={() => void metas.refetch()} />;

  const porCodigo = new Map((metas.data ?? []).map((meta) => [meta.codigo, meta.valor]));

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card rounded-2xl border p-5">
        <header className="mb-4 flex items-center gap-2">
          <Target size={15} aria-hidden="true" className="text-muted-foreground" />
          <div>
            <h2 className="text-foreground text-sm font-semibold">Metas e capacidade</h2>
            <p className="text-muted-foreground text-xs">
              As linhas de referência do gráfico de volume, em Estatísticas operacionais
            </p>
          </div>
        </header>

        <div className="grid gap-5 sm:grid-cols-2">
          {METAS_FIXAS.map((meta) => (
            <CampoMeta
              key={meta.codigo}
              codigo={meta.codigo}
              rotulo={meta.rotulo}
              descricao={meta.descricao}
              valorAtual={porCodigo.get(meta.codigo) ?? null}
              salvando={salvar.isPending && salvar.variables?.codigo === meta.codigo}
              onSalvar={(valor) => salvar.mutate({ codigo: meta.codigo, rotulo: meta.rotulo, valor })}
            />
          ))}
        </div>
      </section>

      <Footnote>
        Sem nenhuma das duas cadastradas, o gráfico de volume não desenha linha de referência
        nenhuma — um valor inventado afirmaria uma meta que ninguém definiu. Salvar de novo troca o
        número; não existe uma segunda meta mensal.
      </Footnote>
    </div>
  );
}

export default MetasOperacionais;
