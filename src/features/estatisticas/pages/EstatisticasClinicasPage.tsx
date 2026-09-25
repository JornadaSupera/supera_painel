import { useState } from "react";

import {
  BarChart,
  ChartCard,
  EmptyState,
  ErrorState,
  FilterPanel,
  Footnote,
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
import { cn } from "@/lib/utils";
import type { FiltroClinico } from "@/services/contracts/operations";
import { MapaDeCalor } from "../components/MapaDeCalor";
import {
  useComparacaoProtocolos,
  useCruzamentoClinico,
  useOpcoesDoCruzamento,
} from "../hooks/useEstatisticas";

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

/**
 * Valor do seletor quando nada está recortado.
 *
 * Um `<SelectItem value="">` é recusado pelo Radix — string vazia é como ele
 * representa "sem seleção", e usá-la como valor de opção quebra o componente.
 */
const TODOS = "todos";
const GRAU_PADRAO = "2";

export function EstatisticasClinicasPage() {
  const [dias, setDias] = useState("90");
  const [grauMinimo, setGrauMinimo] = useState(GRAU_PADRAO);
  const [apenasAtivos, setApenasAtivos] = useState(true);
  const [protocolo, setProtocolo] = useState(TODOS);
  const [sintomaId, setSintomaId] = useState(TODOS);

  // The period stays out of the count: it is always set, and on a phone it
  // is the control that stays in view.
  const aplicados = [
    grauMinimo !== GRAU_PADRAO,
    !apenasAtivos,
    protocolo !== TODOS,
    sintomaId !== TODOS,
  ].filter(Boolean).length;

  const limparFiltros = () => {
    setGrauMinimo(GRAU_PADRAO);
    setApenasAtivos(true);
    setProtocolo(TODOS);
    setSintomaId(TODOS);
  };

  const filtro: FiltroClinico = {
    dias: Number(dias),
    grauMinimo: Number(grauMinimo),
    apenasAtivos,
    protocolo: protocolo === TODOS ? null : protocolo,
    sintomaId: sintomaId === TODOS ? null : sintomaId,
  };

  const cruzamento = useCruzamentoClinico(filtro);
  const comparacao = useComparacaoProtocolos(filtro);

  /* As opções descrevem a JANELA, não o recorte — ver `useOpcoesDoCruzamento`. */
  const opcoes = useOpcoesDoCruzamento(Number(dias));
  const protocolosDisponiveis = opcoes.data?.protocolos ?? [];
  const sintomasDisponiveis = opcoes.data?.sintomas ?? [];

  const dados = cruzamento.data;
  const porPercentual = dados?.prevalencia_disponivel ?? true;
  const filtroIgnorado = dados?.filtros_ignorados?.includes("apenasAtivos") ?? false;

  // "Vazio" só vale quando a consulta REALIZOU e não achou nada. Sem o
  // `!isError`, uma leitura que falhou cai no mesmo ramo e a tela explica a
  // ausência com uma causa falsa — "amplie o período" quando o período nunca
  // foi o problema. O motivo verdadeiro vem no erro, e é ele que deve aparecer.
  const vazio =
    !cruzamento.isLoading && !cruzamento.isError && (dados?.protocolos.length ?? 0) === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Estatísticas"
        title="Estatísticas clínicas"
        level="Médio"
        subtitle="Cruzamento Protocolo × Efeito × Grau · todos os números agregados, sem identificação"
      />

      {/* ---------------------------------------------------------- filtros */}
      <FilterPanel
        lead={
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-medium max-md:hidden">
              Filtros:
            </span>

            <Select value={dias} onValueChange={setDias}>
              <SelectTrigger size="sm" aria-label="Período" className="w-44 max-md:h-9 max-md:w-full">
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
          </div>
        }
        activeCount={aplicados}
        onClear={limparFiltros}
      >
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

        <Select
          value={protocolo}
          onValueChange={setProtocolo}
          disabled={opcoes.isLoading || protocolosDisponiveis.length === 0}
        >
          <SelectTrigger size="sm" aria-label="Protocolo" className="w-52">
            <SelectValue placeholder="Todos os protocolos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os protocolos</SelectItem>
            {protocolosDisponiveis.map((nome) => (
              <SelectItem key={nome} value={nome}>
                {nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sintomaId}
          onValueChange={setSintomaId}
          disabled={opcoes.isLoading || sintomasDisponiveis.length === 0}
        >
          <SelectTrigger size="sm" aria-label="Efeito adverso" className="w-52">
            <SelectValue placeholder="Todos os efeitos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os efeitos</SelectItem>
            {sintomasDisponiveis.map((sintoma) => (
              <SelectItem key={sintoma.id} value={sintoma.id}>
                {sintoma.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Checkbox
            id="apenas-ativos"
            checked={apenasAtivos}
            onCheckedChange={(marcado) => setApenasAtivos(marcado === true)}
            disabled={filtroIgnorado}
          />
          <Label
            htmlFor="apenas-ativos"
            className={cn("text-xs font-normal", filtroIgnorado && "text-muted-foreground")}
          >
            Apenas pacientes ativos
          </Label>
          {/* Um controle que não muda o resultado é pior que um controle
              ausente: quem o marca passa a acreditar num recorte que não houve.
              A origem declara o que ignorou, e aqui ele fica desabilitado com o
              motivo à mão em vez de desaparecer da tela. */}
          {filtroIgnorado && (
            <span
              className="text-muted-foreground text-[11px]"
              title="A leitura agregada do banco soma sobre os registros de diário do período, e diário de paciente arquivado continua sendo registro daquele período. O recorte por situação do paciente entra quando a função aceitá-lo."
            >
              (indisponível nesta origem)
            </span>
          )}
        </div>
      </FilterPanel>

      {/* The size of the cut is a result, not a filter: it stays in view on a
          phone, where the filters themselves move into a sheet. */}
      {dados && (
        <p className="text-muted-foreground -mt-2 text-[11px]">
          {dados.pacientes_considerados === null
            ? `${formatNumber(dados.registros_considerados)} registros no recorte`
            : `${formatNumber(dados.pacientes_considerados)} pacientes no recorte`}
        </p>
      )}

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
            {porPercentual
              ? `% de pacientes com o sintoma em grau ${grauMinimo} ou maior, por protocolo`
              : `Registros do sintoma em grau ${grauMinimo} ou maior, por protocolo`}
          </p>
        </header>

        {cruzamento.isLoading && <SkeletonChart />}

        {cruzamento.isError && (
          <ErrorState error={cruzamento.error} onRetry={() => void cruzamento.refetch()} />
        )}

        {vazio && (
          <EmptyState
            title="Nada a cruzar no recorte"
            description="Nenhum registro de sintoma no período escolhido atinge o grau mínimo. Amplie o período ou baixe o grau mínimo."
          />
        )}

        {dados && !vazio && <MapaDeCalor dados={dados} />}
      </section>

      {/* ------------------------------------------------ leitura comparativa */}
      <ChartCard
        title="Visualização comparativa"
        description={
          porPercentual
            ? `Prevalência média de efeitos em grau ${grauMinimo}+ por protocolo`
            : `Registros de efeitos em grau ${grauMinimo}+ por protocolo`
        }
      >
        {comparacao.isLoading ? (
          <SkeletonChart />
        ) : comparacao.isError ? (
          // Mesma razão do mapa: sem este ramo, a falta de origem viraria
          // "Sem protocolos no recorte" — que afirma sobre a base algo que a
          // consulta não chegou a verificar.
          <ErrorState compact error={comparacao.error} />
        ) : (comparacao.data?.length ?? 0) === 0 ? (
          <EmptyState compact title="Sem protocolos no recorte" />
        ) : (
          <BarChart
            data={(comparacao.data ?? []).map((linha) => ({
              protocolo: linha.protocolo,
              // Sem denominador a barra mede registros, não percentual. Plotar
              // `prevalencia_media ?? 0` desenharia um gráfico de zeros com
              // eixo de porcentagem — a forma mais convincente de afirmar que
              // nenhum protocolo tem efeito adverso.
              medida: (porPercentual ? linha.prevalencia_media : linha.registros) ?? 0,
            }))}
            xKey="protocolo"
            series={[
              { key: "medida", label: porPercentual ? "Prevalência média" : "Registros" },
            ]}
            suffix={porPercentual ? "%" : undefined}
            height={220}
          />
        )}
      </ChartCard>

      <Footnote>
        <StatusBadge tone="neutral" size="sm" className="mr-1.5">
          Sem identificação
        </StatusBadge>
        {porPercentual
          ? "Os números são contagens de pacientes distintos, nunca de registros — quem anotou o mesmo sintoma em vinte dias conta uma vez."
          : "Os números são contagens de registros — quem anotou o mesmo sintoma em vinte dias conta vinte vezes. É carga de relato, não prevalência, e as duas leituras não se substituem."}{" "}
        Nenhuma linha desta tela identifica paciente, e a leitura clínica do que os números
        significam é da equipe.
      </Footnote>
    </div>
  );
}

export default EstatisticasClinicasPage;
