import { useState } from "react";

import {
  BarChart,
  ChartCard,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonChart,
  StatusBadge,
} from "@/components/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import type { FiltroClinico } from "@/services/contracts/operations";
import { MapaDeCalor } from "../components/MapaDeCalor";
import { useComparacaoProtocolos, useCruzamentoClinico } from "../hooks/useEstatisticas";

/**
 * Estatísticas clínicas — Protocolo × Efeito × Grau.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/estatisticas/clinicas/
 *
 * > [!] Os cartões de "Atenção" do protótipo NÃO são reproduzidos.
 * Lá eles dizem coisas como "vale revisar plano de fisioterapia preventiva".
 * Isso é conduta clínica sugerida por software, e o painel não a emite — ele
 * mostra a prevalência e deixa a leitura com quem tem formação para fazê-la. O
 * mesmo mapa continua respondendo à pergunta que originou a tela; o que não
 * acontece é o painel responder no lugar da equipe.
 */

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" },
  { value: "365", label: "Último ano" },
];

const GRAUS = [
  { value: "1", label: "Grau 1 ou mais" },
  { value: "2", label: "Grau 2 ou mais" },
  { value: "3", label: "Grau 3 ou mais" },
  { value: "4", label: "Grau 4 ou mais" },
];

export function EstatisticasClinicasPage() {
  const [dias, setDias] = useState("90");
  const [grauMinimo, setGrauMinimo] = useState("2");
  const [apenasAtivos, setApenasAtivos] = useState(true);

  const filtro: FiltroClinico = {
    dias: Number(dias),
    grauMinimo: Number(grauMinimo),
    apenasAtivos,
  };

  const cruzamento = useCruzamentoClinico(filtro);
  const comparacao = useComparacaoProtocolos(filtro);

  const dados = cruzamento.data;
  const vazio = !cruzamento.isLoading && (dados?.protocolos.length ?? 0) === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Estatísticas"
        title="Estatísticas clínicas"
        level="Médio"
        subtitle="Cruzamento Protocolo × Efeito × Grau · todos os números agregados, sem identificação"
      />

      {/* ---------------------------------------------------------- filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-muted-foreground text-xs font-medium">Filtros:</span>

        <Select value={dias} onValueChange={setDias}>
          <SelectTrigger size="sm" aria-label="Período" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODOS.map((periodo) => (
              <SelectItem key={periodo.value} value={periodo.value}>
                {periodo.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={grauMinimo} onValueChange={setGrauMinimo}>
          <SelectTrigger size="sm" aria-label="Grau mínimo" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRAUS.map((grau) => (
              <SelectItem key={grau.value} value={grau.value}>
                {grau.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="apenas-ativos"
            checked={apenasAtivos}
            onCheckedChange={(marcado) => setApenasAtivos(marcado === true)}
          />
          <Label htmlFor="apenas-ativos" className="text-xs font-normal">
            Apenas pacientes ativos
          </Label>
        </div>

        {dados && (
          <span className="text-muted-foreground text-[11px]">
            {formatNumber(dados.pacientes_considerados)} pacientes no recorte
          </span>
        )}
      </div>

      {/* Amostra truncada é informação, não detalhe: um percentual calculado
          sobre parte da base, apresentado como se fosse a base inteira, vira
          decisão errada em reunião. */}
      {dados?.truncado && (
        <div className="border-warning/30 bg-warning-bg text-warning-foreground rounded-xl border px-4 py-3 text-xs">
          <strong className="font-medium">Recorte parcial.</strong> A leitura atingiu o teto de
          registros do período e o cruzamento considera apenas parte da base. Estreite o período
          antes de usar estes números para decidir.
        </div>
      )}

      {/* ---------------------------------------------------- mapa de calor */}
      <section className="bg-card rounded-2xl border p-5">
        <header className="mb-4">
          <h2 className="text-foreground text-sm font-semibold">Mapa de calor</h2>
          <p className="text-muted-foreground text-xs">
            % de pacientes com o sintoma em grau {grauMinimo} ou maior, por protocolo
          </p>
        </header>

        {cruzamento.isLoading && <SkeletonChart />}

        {cruzamento.isError && (
          <ErrorState error={cruzamento.error} onRetry={() => void cruzamento.refetch()} />
        )}

        {vazio && (
          <EmptyState
            title="Nada a cruzar no recorte"
            description="Não há plano terapêutico vigente com registro de sintoma no período escolhido. Amplie o período ou inclua pacientes inativos."
          />
        )}

        {dados && !vazio && <MapaDeCalor dados={dados} />}
      </section>

      {/* ------------------------------------------------ leitura comparativa */}
      <ChartCard
        title="Visualização comparativa"
        description={`Prevalência média de efeitos em grau ${grauMinimo}+ por protocolo`}
      >
        {comparacao.isLoading ? (
          <SkeletonChart />
        ) : (comparacao.data?.length ?? 0) === 0 ? (
          <EmptyState compact title="Sem protocolos no recorte" />
        ) : (
          <BarChart
            data={(comparacao.data ?? []).map((linha) => ({
              protocolo: linha.protocolo,
              prevalencia: linha.prevalencia_media ?? 0,
            }))}
            xKey="protocolo"
            series={[{ key: "prevalencia", label: "Prevalência média" }]}
            suffix="%"
            height={220}
          />
        )}
      </ChartCard>

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        <StatusBadge tone="neutral" size="sm" className="mr-1.5">
          Sem identificação
        </StatusBadge>
        Os números são contagens de pacientes distintos, nunca de registros — quem anotou o mesmo
        sintoma em vinte dias conta uma vez. Nenhuma linha desta tela identifica paciente, e a
        leitura clínica do que os números significam é da equipe.
      </p>
    </div>
  );
}

export default EstatisticasClinicasPage;
