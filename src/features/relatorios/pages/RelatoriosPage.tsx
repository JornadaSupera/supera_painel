import { BarChart3, Download, Lock, Play, Table2 } from "lucide-react";
import { useState } from "react";

import {
  BarChart,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonCards,
  SkeletonTable,
  StatusBadge,
  type Column,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/format";
import {
  CATEGORIA_RELATORIO_LABEL,
  FILTRO_RELATORIO_LABEL,
  type CategoriaRelatorio,
  type DefinicaoRelatorio,
} from "@/types/relatorio";
import { useDefinicoes, useExportarRelatorio, useRelatorio } from "../hooks/useRelatorios";

/**
 * Relatórios — o conjunto fechado de doze.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/relatorios/
 *
 * Doze definições, um motor. O cartão abre o resultado numa janela, com tabela
 * ou gráfico e exportação em CSV — em vez de doze rotas quase iguais.
 *
 * Onde nos afastamos do protótipo, e por quê:
 *
 *  - **"Agendar por e-mail" e "Exportar todos"**: agendamento exige rotina
 *    agendada e serviço de disparo; link compartilhável exige tabela de token
 *    com expiração. Nenhum dos dois existe, e ambos são caminhos por onde dado
 *    clínico sai da clínica — não é o tipo de coisa a improvisar no cliente.
 *  - **Três cartões marcados como indisponíveis**: alertas de IA, NPS e
 *    conteúdo mais acessado não têm origem no banco. O cartão fica, com o
 *    motivo: o conjunto de doze é contratado, e escondê-los mascararia o que
 *    ainda falta.
 *  - **Exportação em Excel**: sai em CSV, que o Excel abre. Uma planilha
 *    binária exigiria uma dependência fora da lista contratada.
 */

const ORDEM: CategoriaRelatorio[] = ["pacientes", "clinico", "operacional", "qualidade"];

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" },
  { value: "365", label: "Último ano" },
];

export function RelatoriosPage() {
  const [dias, setDias] = useState("30");
  const [aberto, setAberto] = useState<DefinicaoRelatorio | null>(null);

  const definicoes = useDefinicoes();

  const porCategoria = (categoria: CategoriaRelatorio) =>
    (definicoes.data ?? []).filter((definicao) => definicao.categoria === categoria);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Relatórios"
        title="Relatórios"
        level="MVP"
        subtitle="Conjunto fechado de 12 · filtros próprios por relatório · exportação em CSV"
        actions={
          <Select value={dias} onValueChange={setDias}>
            <SelectTrigger size="sm" aria-label="Período padrão" className="w-44">
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
        }
      />

      {definicoes.isError && (
        <ErrorState error={definicoes.error} onRetry={() => void definicoes.refetch()} />
      )}

      {definicoes.isLoading && <SkeletonCards count={6} />}

      {ORDEM.map((categoria) => {
        const lista = porCategoria(categoria);
        if (lista.length === 0) return null;

        return (
          <section key={categoria} className="flex flex-col gap-3">
            <h2 className="text-foreground text-sm font-semibold">
              {CATEGORIA_RELATORIO_LABEL[categoria]}
              <span className="text-muted-foreground font-normal"> · {lista.length}</span>
            </h2>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {lista.map((definicao) => (
                <CartaoRelatorio
                  key={definicao.slug}
                  definicao={definicao}
                  onAbrir={() => setAberto(definicao)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Filtros pré-configurados entregam a maior parte do valor com uma fração da complexidade.
        Cruzamentos livres ficam para quando houver histórico que os justifique — o cruzamento
        clínico que a equipe mais pediu já tem tela própria em{" "}
        <strong>Estatísticas → Clínicas</strong>.
      </p>

      <JanelaRelatorio
        definicao={aberto}
        dias={Number(dias)}
        onOpenChange={(estaAberta) => !estaAberta && setAberto(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------
   CARTÃO
   ------------------------------------------------------------------------- */

function CartaoRelatorio({
  definicao,
  onAbrir,
}: {
  definicao: DefinicaoRelatorio;
  onAbrir: () => void;
}) {
  return (
    <article className="bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <header className="flex items-start gap-3">
        <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
          {definicao.numero}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-foreground text-sm leading-snug font-medium">{definicao.titulo}</h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {definicao.descricao}
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-1.5">
        {definicao.filtros.map((filtro) => (
          <StatusBadge key={filtro} tone="neutral" size="sm">
            {FILTRO_RELATORIO_LABEL[filtro]}
          </StatusBadge>
        ))}
      </div>

      {definicao.disponivel ? (
        <Button size="sm" variant="outline" className="self-start" onClick={onAbrir}>
          <Play />
          Abrir relatório
        </Button>
      ) : (
        // O motivo fica no próprio cartão: quem procura o relatório precisa
        // saber por que ele não roda, não descobrir isso ao clicar.
        <p className="border-border/70 text-muted-foreground flex items-start gap-1.5 rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed">
          <Lock size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
          {definicao.motivo ?? "Sem origem de dados no backend."}
        </p>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------
   JANELA DO RESULTADO
   ------------------------------------------------------------------------- */

function JanelaRelatorio({
  definicao,
  dias,
  onOpenChange,
}: {
  definicao: DefinicaoRelatorio | null;
  dias: number;
  onOpenChange: (aberto: boolean) => void;
}) {
  const [visao, setVisao] = useState<"tabela" | "grafico">("tabela");

  const relatorio = useRelatorio(definicao?.slug, dias);
  const exportar = useExportarRelatorio();

  const dados = relatorio.data;

  const colunas: Column<Record<string, string | number>>[] = (dados?.colunas ?? []).map(
    (coluna) => ({
      key: coluna.key,
      header: coluna.label,
      align: coluna.numerica ? "right" : "left",
      mono: coluna.numerica,
      render: (linha) => (
        <span className="text-xs">
          {typeof linha[coluna.key] === "number"
            ? formatNumber(linha[coluna.key] as number)
            : String(linha[coluna.key] ?? "—")}
        </span>
      ),
    }),
  );

  const podeGraficar = Boolean(dados?.eixo && dados?.medida && (dados?.linhas.length ?? 0) > 0);

  return (
    <Dialog open={definicao !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {definicao?.numero} · {definicao?.titulo}
          </DialogTitle>
          <DialogDescription>{dados?.resumo ?? definicao?.descricao}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant={visao === "tabela" ? "secondary" : "ghost"}
              onClick={() => setVisao("tabela")}
            >
              <Table2 />
              Tabela
            </Button>

            <Button
              size="sm"
              variant={visao === "grafico" ? "secondary" : "ghost"}
              disabled={!podeGraficar}
              onClick={() => setVisao("grafico")}
            >
              <BarChart3 />
              Gráfico
            </Button>
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={exportar.isPending || (dados?.linhas.length ?? 0) === 0}
            onClick={() =>
              definicao && exportar.mutate({ slug: definicao.slug, dias })
            }
          >
            <Download />
            Exportar CSV
          </Button>
        </div>

        {relatorio.isLoading && <SkeletonTable columns={4} />}

        {relatorio.isError && (
          <ErrorState error={relatorio.error} onRetry={() => void relatorio.refetch()} />
        )}

        {dados && dados.linhas.length === 0 && (
          <EmptyState
            title="Sem dados no período"
            description="O relatório rodou, mas não há registros no recorte escolhido. Amplie o período no cabeçalho da tela."
          />
        )}

        {dados && dados.linhas.length > 0 && visao === "tabela" && (
          <div className="overflow-hidden rounded-xl border">
            <DataTable
              columns={colunas}
              data={dados.linhas}
              getRowId={(linha) => String(linha[dados.colunas[0]?.key ?? ""] ?? Math.random())}
              caption={`${dados.titulo}. ${dados.resumo}`}
              label="linhas"
              density="compact"
            />
          </div>
        )}

        {dados && podeGraficar && visao === "grafico" && (
          <BarChart
            data={dados.linhas}
            xKey={dados.eixo as string}
            series={[
              {
                key: dados.medida as string,
                label:
                  dados.colunas.find((coluna) => coluna.key === dados.medida)?.label ?? "Valor",
              },
            ]}
            height={260}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RelatoriosPage;
