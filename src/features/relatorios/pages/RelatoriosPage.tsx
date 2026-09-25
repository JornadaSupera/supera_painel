import { BarChart3, Download, Lock, Play, Table2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";

import {
  BarChart,
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  Footnote,
  PageHeader,
  SkeletonCards,
  SkeletonTable,
  StatusBadge,
} from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useEspecialidades } from "@/hooks/useCatalogos";
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

/** Valor do seletor quando nenhuma área está recortada. Ver `TODOS` na tela de Estatísticas. */
const TODAS = "todas";

const PERIODOS = [
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 180 dias" },
  { value: "365", label: "Último ano" },
];

/**
 * O relatório aberto e o período vivem na URL.
 *
 * É o que o escopo chama de **link interno**: `/relatorios/faltas?dias=90` abre
 * o mesmo resultado para quem receber o endereço, em vez de "abra Relatórios,
 * role até Operacional, clique em Faltas e troque o período". Um estado que
 * existe só em memória não se manda para ninguém.
 *
 * A rota é a MESMA tela — `/relatorios` e `/relatorios/:slug` renderizam este
 * componente. Sem remontagem, a janela abre sobre a lista já carregada, e
 * fechar volta para onde a pessoa estava.
 */
export function RelatoriosPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const dias = searchParams.get("dias") ?? "30";
  const definicoes = useDefinicoes();

  const porCategoria = (categoria: CategoriaRelatorio) =>
    (definicoes.data ?? []).filter((definicao) => definicao.categoria === categoria);

  const aberto = slug
    ? ((definicoes.data ?? []).find((definicao) => definicao.slug === slug) ?? null)
    : null;

  /*
   * Slug que não existe no catálogo não abre janela nenhuma, e a lista atrás
   * dela ficaria com cara de página certa. O aviso diz o que aconteceu — um
   * link antigo, um relatório renomeado — em vez de deixar a pessoa procurando
   * o que ela veio abrir.
   */
  const slugDesconhecido = Boolean(slug) && !definicoes.isLoading && !aberto;

  const abrir = (definicao: DefinicaoRelatorio) =>
    navigate(`/relatorios/${definicao.slug}?dias=${dias}`);

  const fechar = () => navigate(`/relatorios?dias=${dias}`);

  const trocarPeriodo = (valor: string) =>
    setSearchParams(valor === "30" ? {} : { dias: valor }, { replace: true });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Relatórios"
        title="Relatórios"
        subtitle="Conjunto fechado de 12 · filtros próprios por relatório · exportação em CSV"
        actions={
          <Select value={dias} onValueChange={trocarPeriodo}>
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

      {slugDesconhecido && (
        <Alert role="status">
          <TriangleAlert />
          <AlertTitle>Relatório não encontrado</AlertTitle>
          <AlertDescription>
            Não existe relatório com o endereço <code className="font-mono">{slug}</code>. O link
            pode ser antigo — os doze do conjunto estão abaixo.
          </AlertDescription>
        </Alert>
      )}

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
                  onAbrir={() => abrir(definicao)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <Footnote>
        Filtros pré-configurados entregam a maior parte do valor com uma fração da complexidade.
        Cruzamentos livres ficam para quando houver histórico que os justifique — o cruzamento
        clínico que a equipe mais pediu já tem tela própria em{" "}
        <strong>Estatísticas → Clínicas</strong>.
      </Footnote>

      <JanelaRelatorio
        definicao={aberto}
        dias={Number(dias)}
        onOpenChange={(estaAberta) => !estaAberta && fechar()}
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
  const [especialidade, setEspecialidade] = useState(TODAS);

  /*
   * O seletor só aparece onde a definição do relatório declara o filtro. É a
   * mesma lista que o adapter consulta para decidir se o recorte tem efeito —
   * oferecer o controle onde ele não muda nada faria quem o usa acreditar num
   * recorte que não houve.
   */
  const aceitaEspecialidade = definicao?.filtros.includes("especialidade") ?? false;
  const especialidades = useEspecialidades();

  const recorte = aceitaEspecialidade && especialidade !== TODAS ? especialidade : null;

  const relatorio = useRelatorio(definicao?.slug, dias, recorte);
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

            {aceitaEspecialidade && (
              <Select value={especialidade} onValueChange={setEspecialidade}>
                <SelectTrigger size="sm" aria-label="Especialidade" className="ml-1.5 w-48">
                  <SelectValue placeholder="Todas as especialidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as especialidades</SelectItem>
                  {(especialidades.data ?? []).map((area) => (
                    <SelectItem key={area.value} value={area.value}>
                      {area.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            disabled={exportar.isPending || (dados?.linhas.length ?? 0) === 0}
            onClick={() =>
              definicao && exportar.mutate({ slug: definicao.slug, dias, especialidade: recorte })
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
