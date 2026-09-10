import { EyeOff, FilterX } from "lucide-react";
import { useState } from "react";

import {
  BackendPendente,
  Can,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  SearchInput,
  SkeletonCards,
  StatusBadge,
  TONE_CONTENT_STATUS,
  type Column,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import {
  ACAO_REVISAO,
  ESPECIALIDADE_LABEL,
  STATUS_CONTEUDO_LABEL,
  TIPO_CONTEUDO_LABEL,
  toOptions,
  type AcaoRevisao,
} from "@/lib/enums";
import { formatNumber } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { motivoIndisponivel } from "@/services/apiClient";
import { temRecorte, useConteudosStore } from "@/stores/conteudos";
import type { ConteudoListItem } from "@/types/conteudo";
import { CartaoRevisao } from "../components/CartaoRevisao";
import { DialogRevisao } from "../components/DialogRevisao";
import { useConteudos, useFilaRevisao, useRevisarConteudo } from "../hooks/useConteudos";

/**
 * Aprovação de conteúdo — o workflow editorial.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/conteudo/
 *
 * A fila "Aguardando revisão" e a lista "Publicados" ficam na MESMA tela, como
 * no protótipo. Não existe `/conteudo/aprovacoes`: são duas perguntas sobre o
 * mesmo acervo — o que espera decisão e o que já está no ar —, e separá-las em
 * rotas faria a pessoa navegar de ida e volta a cada aprovação.
 *
 * Onde nos afastamos do protótipo, e por quê:
 *
 *  - **Coluna "Visualizações"**: o protótipo mostra a contagem de acessos. A
 *    origem dela é a biblioteca do paciente, que nem a equipe nem a
 *    administração podem ler. A coluna diz isso em vez de exibir um zero.
 *  - **Botão "Nova orientação"**: não existe. Redigir é do profissional da
 *    área; o painel administrativo revisa.
 */

const TODOS = "todos";

export function ConteudoPage() {
  const { can } = useAuth();

  const [emDecisao, setEmDecisao] = useState<ConteudoListItem | null>(null);
  const [acao, setAcao] = useState<AcaoRevisao | null>(null);

  const fila = useFilaRevisao();
  const publicados = useConteudos();
  const revisar = useRevisarConteudo();

  const busca = useConteudosStore((estado) => estado.busca);
  const filtros = useConteudosStore((estado) => estado.filtros);
  const sort = useConteudosStore((estado) => estado.sort);
  const page = useConteudosStore((estado) => estado.page);
  const pageSize = useConteudosStore((estado) => estado.pageSize);
  const setBusca = useConteudosStore((estado) => estado.setBusca);
  const setFiltro = useConteudosStore((estado) => estado.setFiltro);
  const limparFiltros = useConteudosStore((estado) => estado.limparFiltros);
  const setSort = useConteudosStore((estado) => estado.setSort);
  const setPage = useConteudosStore((estado) => estado.setPage);
  const setPageSize = useConteudosStore((estado) => estado.setPageSize);

  const filtrada = temRecorte(busca, filtros);
  const semContagemDeAcessos = motivoIndisponivel("conteudos.list.visualizacoes");

  function abrirDecisao(conteudo: ConteudoListItem, proximaAcao: AcaoRevisao) {
    setEmDecisao(conteudo);
    setAcao(proximaAcao);
  }

  function confirmar(comentario: string) {
    if (!emDecisao || !acao) return;

    revisar.mutate(
      { id: emDecisao.id, acao, comentario },
      {
        onSuccess: () => {
          setEmDecisao(null);
          setAcao(null);
        },
      },
    );
  }

  const colunas: Column<ConteudoListItem>[] = [
    {
      key: "titulo",
      header: "Orientação",
      sortable: true,
      width: "44%",
      render: (conteudo) => (
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-medium">{conteudo.titulo}</p>

          {conteudo.confidencial && !can(PERMISSAO.SIGILO_PSICOLOGIA) ? (
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-[11px]">
              <EyeOff size={11} aria-hidden="true" />
              Sob sigilo profissional
            </p>
          ) : (
            <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{conteudo.resumo}</p>
          )}
        </div>
      ),
    },
    {
      key: "categoria",
      header: "Área",
      sortable: true,
      width: "16%",
      render: (conteudo) => <span className="text-xs">{conteudo.categoria}</span>,
    },
    {
      key: "tipo",
      header: "Tipo",
      width: 100,
      render: (conteudo) => (
        <span className="text-muted-foreground text-xs">{TIPO_CONTEUDO_LABEL[conteudo.tipo]}</span>
      ),
    },
    {
      key: "versao",
      header: "Versão",
      align: "right",
      width: 80,
      mono: true,
      render: (conteudo) => <span className="text-xs">{conteudo.versao}</span>,
    },
    {
      key: "visualizacoes",
      header: "Acessos",
      align: "right",
      width: 110,
      mono: true,
      render: (conteudo) =>
        conteudo.visualizacoes === null ? (
          // O traço é clicável no tooltip do cabeçalho? Não — o motivo fica no
          // aviso abaixo da tabela, uma vez só, em vez de repetido por linha.
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <span className="text-xs">{formatNumber(conteudo.visualizacoes)}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: 130,
      render: (conteudo) => (
        <StatusBadge tone={TONE_CONTENT_STATUS[conteudo.status]} size="sm" dot>
          {STATUS_CONTEUDO_LABEL[conteudo.status]}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      width: 130,
      render: (conteudo) => (
        <Can permission={PERMISSAO.CONTEUDO_PUBLISH}>
          {conteudo.status === "publicado" && (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={revisar.isPending}
              onClick={() => abrirDecisao(conteudo, ACAO_REVISAO.DESPUBLICAR)}
            >
              Despublicar
            </Button>
          )}
        </Can>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Conteúdo"
        title="Aprovação de conteúdo"
        level="MVP"
        subtitle="Workflow editorial · orientações esperam aprovação antes de chegar aos pacientes"
      />

      {/* -------------------------------------------------- fila de revisão */}
      <section className="flex flex-col gap-3" aria-labelledby="titulo-fila">
        <div className="flex items-center justify-between gap-3">
          <h2 id="titulo-fila" className="text-foreground text-sm font-semibold">
            Aguardando revisão
            {fila.total > 0 && (
              <span className="text-muted-foreground font-normal"> · {fila.total}</span>
            )}
          </h2>
        </div>

        {fila.isLoading && <SkeletonCards count={3} />}

        {fila.isError && <ErrorState error={fila.error} onRetry={() => void fila.refetch()} />}

        {!fila.isLoading && !fila.isError && fila.fila.length === 0 && (
          <EmptyState
            title="Nada aguardando revisão"
            description="Quando um profissional enviar uma orientação, ela aparece aqui para aprovação."
          />
        )}

        {fila.fila.map((conteudo) => (
          <CartaoRevisao
            key={conteudo.id}
            conteudo={conteudo}
            ocupado={revisar.isPending}
            onDecidir={abrirDecisao}
            onAbrir={(item) => abrirDecisao(item, ACAO_REVISAO.APROVAR)}
          />
        ))}
      </section>

      {/* ----------------------------------------------------- biblioteca */}
      <section className="flex flex-col gap-3" aria-labelledby="titulo-publicados">
        <h2 id="titulo-publicados" className="text-foreground text-sm font-semibold">
          Biblioteca
          {publicados.total > 0 && (
            <span className="text-muted-foreground font-normal">
              {" "}
              · {formatNumber(publicados.total)}
            </span>
          )}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={busca}
            onChange={setBusca}
            placeholder="Buscar orientação…"
            label="Buscar orientação"
            className="min-w-60 flex-1"
          />

          <Select
            value={filtros.status || TODOS}
            onValueChange={(valor) => setFiltro("status", valor === TODOS ? "" : valor)}
          >
            <SelectTrigger size="sm" aria-label="Status" className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Status: todos</SelectItem>
              {toOptions(STATUS_CONTEUDO_LABEL).map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtros.especialidade || TODOS}
            onValueChange={(valor) => setFiltro("especialidade", valor === TODOS ? "" : valor)}
          >
            <SelectTrigger size="sm" aria-label="Área" className="w-48">
              <SelectValue placeholder="Área" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Área: todas</SelectItem>
              {toOptions(ESPECIALIDADE_LABEL).map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filtros.tipo || TODOS}
            onValueChange={(valor) => setFiltro("tipo", valor === TODOS ? "" : valor)}
          >
            <SelectTrigger size="sm" aria-label="Tipo" className="w-36">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Tipo: todos</SelectItem>
              {toOptions(TIPO_CONTEUDO_LABEL).map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {filtrada && (
            <Button variant="ghost" size="sm" onClick={limparFiltros}>
              <FilterX />
              Limpar
            </Button>
          )}
        </div>

        <div className="bg-card overflow-hidden rounded-2xl border">
          <DataTable
            columns={colunas}
            data={publicados.conteudos}
            caption="Orientações da biblioteca, com área, tipo, versão vigente e status de publicação."
            label="orientações"
            loading={publicados.isLoading}
            error={publicados.isError ? publicados.error : null}
            onRetry={() => void publicados.refetch()}
            sort={sort}
            onSortChange={setSort}
            filtered={filtrada}
            pagination={{
              page,
              pageSize,
              count: publicados.total,
              onPageChange: setPage,
              onPageSizeChange: setPageSize,
            }}
            emptyState={
              <EmptyState
                variant={filtrada ? "search" : "empty"}
                title={filtrada ? "Nenhuma orientação no recorte" : "Biblioteca vazia"}
                description={
                  filtrada
                    ? "Nenhuma orientação corresponde à busca e aos filtros aplicados."
                    : "Assim que a equipe publicar a primeira orientação, ela aparece aqui."
                }
              />
            }
          />
        </div>

        {semContagemDeAcessos && (
          <BackendPendente titulo="Contagem de acessos" motivo={semContagemDeAcessos} />
        )}
      </section>

      <DialogRevisao
        conteudo={emDecisao}
        acao={acao}
        aberto={emDecisao !== null}
        enviando={revisar.isPending}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setEmDecisao(null);
            setAcao(null);
          }
        }}
        onConfirmar={confirmar}
      />
    </div>
  );
}

export default ConteudoPage;
