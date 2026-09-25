import { useState } from "react";

import { Download, FileJson, ShieldCheck } from "lucide-react";

import {
  BackendPendente,
  DataTable,
  EmptyState,
  FilterPanel,
  FilterSelect,
  Footnote,
  PageHeader,
  SearchInput,
  SkeletonCards,
  StatCard,
  StatusBadge,
  TONE_AUDIT_ACTION,
  UserAvatar,
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
import {
  ACAO_AUDITORIA_LABEL,
  ORIGEM_AUDITORIA_LABEL,
  toOptions,
  type Option,
} from "@/lib/enums";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { motivoIndisponivel } from "@/services/apiClient";
import { JANELAS, useAuditoriaStore } from "@/stores/auditoria";
import { hasActiveFilters } from "@/stores/listStore";
import type { AuditoriaListItem, OpcaoFiltroAuditoria } from "@/types/auditoria";
import {
  useExportarTrilha,
  useFacetasAuditoria,
  useRegistroAuditoria,
  useResumoAuditoria,
  useTrilha,
} from "../hooks/useAuditoria";
import { DetalheAcesso } from "../components/DetalheAcesso";

/**
 * Auditoria & logs — o rastro de acesso a dado sensível.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/auditoria/
 *
 * Onde nos afastamos do protótipo, e por quê:
 *
 *  - **Cartão "Exportação"**: o protótipo mostra cinco contadores; a trilha
 *    sabe separar quatro. O que falta não é zerado — um zero afirmaria que
 *    ninguém exportou nada, e a verdade é que baixar um arquivo acontece no
 *    navegador e não chega ao banco. O motivo aparece embaixo da faixa.
 *  - **Coluna "De onde"**: o protótipo mostra só o endereço. Aqui ele vem
 *    acompanhado da qualidade em que a pessoa agiu — titular, acompanhante,
 *    equipe —, que é o que distingue duas ações feitas sobre a mesma ficha.
 *  - **Seletor de janela**: o protótipo fixa "24h". Aqui a janela é escolhida,
 *    porque a mesma tela responde "o que aconteceu hoje" e "quem abriu a ficha
 *    desta pessoa nos últimos 90 dias" — a segunda é a pergunta de uma apuração.
 */

/** Quem aparece na trilha, com o volume ao lado: "Ana Souza · 12". */
function comoOpcoes(opcoes: OpcaoFiltroAuditoria[]): Option[] {
  return opcoes.map((opcao) => ({ value: opcao.id, label: `${opcao.nome} · ${opcao.total}` }));
}

export function AuditoriaPage() {
  const { registros, total, isLoading, isError, error, refetch } = useTrilha();
  const resumo = useResumoAuditoria();
  const exportar = useExportarTrilha();

  const busca = useAuditoriaStore((estado) => estado.busca);
  const filtros = useAuditoriaStore((estado) => estado.filtros);
  const janelaDias = useAuditoriaStore((estado) => estado.janelaDias);
  const sort = useAuditoriaStore((estado) => estado.sort);
  const page = useAuditoriaStore((estado) => estado.page);
  const pageSize = useAuditoriaStore((estado) => estado.pageSize);
  const setBusca = useAuditoriaStore((estado) => estado.setBusca);
  const setFiltro = useAuditoriaStore((estado) => estado.setFiltro);
  const setJanela = useAuditoriaStore((estado) => estado.setJanela);
  const limparFiltros = useAuditoriaStore((estado) => estado.limparFiltros);
  const setSort = useAuditoriaStore((estado) => estado.setSort);
  const setPage = useAuditoriaStore((estado) => estado.setPage);
  const setPageSize = useAuditoriaStore((estado) => estado.setPageSize);

  const facetas = useFacetasAuditoria();
  const atores = facetas.data?.atores ?? [];
  const pacientesNaTrilha = facetas.data?.pacientes ?? [];

  // O registro aberto no painel de detalhe. `null` = nenhum.
  const [registroAberto, setRegistroAberto] = useState<string | null>(null);
  const detalhe = useRegistroAuditoria(registroAberto);

  const filtrada = hasActiveFilters(busca, filtros);

  const semOrigem = resumo.data?.sem_origem ?? [];
  const motivoSemOrigem = semOrigem
    .map((acao) => motivoIndisponivel(`auditoria.summary.${acao}`))
    .filter((motivo): motivo is string => motivo !== null)
    .join(" ");

  const colunas: Column<AuditoriaListItem>[] = [
    {
      key: "usuario_nome",
      header: "Quem",
      sortable: true,
      width: "22%",
      render: (registro) => (
        <div className="flex items-center gap-2.5">
          <UserAvatar name={registro.usuario_nome} size="sm" colorful className="shrink-0" />
          <span className="text-foreground truncate text-sm font-medium">
            {registro.usuario_nome}
          </span>
        </div>
      ),
    },
    {
      key: "acao",
      header: "Ação",
      sortable: true,
      width: 120,
      render: (registro) => (
        <StatusBadge tone={TONE_AUDIT_ACTION[registro.acao]} size="sm" dot>
          {ACAO_AUDITORIA_LABEL[registro.acao]}
        </StatusBadge>
      ),
    },
    {
      key: "recurso_label",
      header: "O quê",
      sortable: true,
      width: "26%",
      render: (registro) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-foreground truncate text-xs">{registro.recurso_label}</p>

            {/* Diz QUE houve acesso a material sob sigilo, nunca de quem nem
                qual — ver `AuditoriaListItem.material_restrito`. */}
            {registro.material_restrito && (
              <StatusBadge tone="warning" size="sm" className="shrink-0">
                Sigiloso
              </StatusBadge>
            )}
          </div>

          {registro.paciente_nome && (
            <p className="text-muted-foreground truncate text-[11px]">
              paciente · {registro.paciente_nome}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "linhas",
      header: "Linhas",
      align: "right",
      width: 90,
      mono: true,
      // On a tablet this column is what pushed "Quando" behind a sideways
      // scroll. The row detail and the export still carry it.
      hideBelow: "lg",
      render: (registro) => (
        <span className="text-xs">
          {registro.linhas === null ? "—" : formatNumber(registro.linhas)}
        </span>
      ),
    },
    {
      key: "origem",
      header: "De onde",
      width: 150,
      render: (registro) => (
        <div className="min-w-0">
          <p className="text-foreground truncate text-xs">
            {ORIGEM_AUDITORIA_LABEL[registro.origem]}
          </p>
          {/* Sem endereço é resposta legítima: chamada fora da web não tem um.
              O traço diz isso sem ocupar a linha com explicação — o detalhe do
              acesso tem espaço para ela. */}
          <p className="text-muted-foreground truncate font-mono text-[11px]">
            {registro.ip ?? "—"}
          </p>
        </div>
      ),
    },
    {
      key: "criado_em",
      header: "Quando",
      sortable: true,
      width: 170,
      render: (registro) => (
        <div className="min-w-0">
          <time className="text-xs tabular-nums" dateTime={registro.criado_em}>
            {formatDateTime(registro.criado_em)}
          </time>
          <p className="text-muted-foreground text-[11px]">{relativeTime(registro.criado_em)}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Compliance LGPD"
        title="Auditoria & logs"
        level="Médio"
        subtitle="Trilha imutável de acesso a dados sensíveis · retenção de 5 anos"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={exportar.isPending || total === 0}
              onClick={() => exportar.mutate("csv")}
            >
              <Download />
              CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={exportar.isPending || total === 0}
              onClick={() => exportar.mutate("json")}
            >
              <FileJson />
              JSON
            </Button>
          </div>
        }
      />

      {/* ------------------------------------------------------- contadores */}
      <section aria-label="Resumo da janela">
        {/* Two by two on a phone and four across from lg. One column stacked
            the counters ~400px tall before the trail even started, and three
            across left "Sigiloso" alone on a second row. */}
        {resumo.isLoading ? (
          <SkeletonCards count={4} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {(resumo.data?.contagens ?? []).map((contagem) => (
              <StatCard
                key={contagem.acao}
                label={contagem.label}
                value={formatNumber(contagem.total)}
                context={`últimas ${resumo.data?.janela_horas ?? 24} h`}
                icon={<ShieldCheck />}
              />
            ))}
          </div>
        )}

        {/* As categorias que a trilha não separa. Ver o cabeçalho do arquivo:
            zerar seria afirmar ausência de acesso sigiloso, que é diferente de
            não saber contá-lo. */}
        {motivoSemOrigem && (
          <BackendPendente
            className="mt-4"
            titulo={semOrigem.map((acao) => ACAO_AUDITORIA_LABEL[acao]).join(" e ")}
            motivo={motivoSemOrigem}
          />
        )}
      </section>

      {/* ---------------------------------------------------------- filtros */}
      <FilterPanel
        lead={
          <SearchInput
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por pessoa, recurso ou paciente…"
            label="Buscar na trilha"
            className="min-w-60 flex-1"
          />
        }
        activeCount={Object.values(filtros).filter(Boolean).length}
        canClear={filtrada}
        onClear={limparFiltros}
      >
        <Select value={janelaDias || "tudo"} onValueChange={(v) => setJanela(v === "tudo" ? "" : v)}>
          <SelectTrigger size="sm" aria-label="Período" className="w-48">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {JANELAS.map((janela) => (
              <SelectItem key={janela.value || "tudo"} value={janela.value || "tudo"}>
                {janela.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <FilterSelect
          label="Tipo de ação"
          allLabel="Ação: todas"
          value={filtros.acao}
          onChange={(valor) => setFiltro("acao", valor)}
          options={toOptions(ACAO_AUDITORIA_LABEL)}
          className="w-40"
        />

        {/* Usuário e paciente fecham os quatro recortes que o escopo pede.
            As opções saem da própria trilha — ver `useFacetasAuditoria`. */}
        <FilterSelect
          label="Usuário"
          value={filtros.usuario_id}
          onChange={(valor) => setFiltro("usuario_id", valor)}
          options={comoOpcoes(atores)}
          className="w-52"
        />

        <FilterSelect
          label="Paciente"
          value={filtros.paciente_id}
          onChange={(valor) => setFiltro("paciente_id", valor)}
          options={comoOpcoes(pacientesNaTrilha)}
          className="w-52"
        />

        {/* O recorte que separa o titular de quem o acompanha. O escopo pede a
            identificação das ações do acompanhante, e sem este seletor a única
            forma de isolá-las é percorrer a trilha à mão. */}
        <FilterSelect
          label="Origem"
          allLabel="Origem: todas"
          value={filtros.origem}
          onChange={(valor) => setFiltro("origem", valor)}
          options={toOptions(ORIGEM_AUDITORIA_LABEL)}
          className="w-44"
        />
      </FilterPanel>

      {/* Um seletor incompleto que se apresenta como completo faz quem apura
          concluir que não há rastro de alguém. */}
      {facetas.data?.truncado && (
        <p className="text-muted-foreground text-[11px]">
          A janela tem mais registros do que o backend devolve de uma vez: os seletores de usuário
          e de paciente podem não listar todo mundo. Estreite o período para fechar a lista.
        </p>
      )}

      {/* ----------------------------------------------------------- trilha */}
      <div className="bg-card overflow-hidden rounded-2xl border">
        <DataTable
          columns={colunas}
          data={registros}
          caption="Registros de acesso a dados sensíveis, com autor, ação, recurso alcançado e horário."
          label="registros"
          loading={isLoading}
          error={isError ? error : null}
          onRetry={() => void refetch()}
          sort={sort}
          onSortChange={setSort}
          filtered={filtrada}
          onRowClick={(registro) => setRegistroAberto(registro.id)}
          pagination={{
            page,
            pageSize,
            count: total,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyState={
            <EmptyState
              variant={filtrada ? "search" : "empty"}
              title={filtrada ? "Nenhum registro no recorte" : "Nenhum acesso registrado"}
              description={
                filtrada
                  ? "Nenhum acesso corresponde à busca, ao período e aos filtros aplicados."
                  : "Nada foi acessado na janela escolhida. Amplie o período para ver registros mais antigos."
              }
            />
          }
        />
      </div>

      <div className="flex flex-col gap-3">
        <Footnote>
          <StatusBadge tone="neutral" size="sm" className="mr-1.5">
            Imutável
          </StatusBadge>
          Registros de auditoria não são alterados nem apagados por nenhuma tela deste painel. A
          exportação em CSV ou JSON atende ao relatório do encarregado de dados, e leva as colunas
          de origem e de material restrito junto.
        </Footnote>
      </div>

      <DetalheAcesso
        registro={detalhe.data ?? null}
        carregando={detalhe.isLoading}
        aberto={registroAberto !== null}
        onFechar={() => setRegistroAberto(null)}
      />
    </div>
  );
}

export default AuditoriaPage;
