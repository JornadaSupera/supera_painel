import { Download, FileJson, FilterX, ShieldCheck } from "lucide-react";

import {
  BackendPendente,
  DataTable,
  EmptyState,
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
import { ACAO_AUDITORIA_LABEL, toOptions } from "@/lib/enums";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { motivoIndisponivel } from "@/services/apiClient";
import { JANELAS, temRecorte, useAuditoriaStore } from "@/stores/auditoria";
import type { AuditoriaListItem } from "@/types/auditoria";
import { useExportarTrilha, useResumoAuditoria, useTrilha } from "../hooks/useAuditoria";

/**
 * Auditoria & logs — o rastro de acesso a dado sensível.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/auditoria/
 *
 * Onde nos afastamos do protótipo, e por quê:
 *
 *  - **Cartões "Sigiloso" e "Exportação"**: o protótipo mostra cinco
 *    contadores; a trilha só sabe separar três. Os dois que faltam não são
 *    zerados — um zero afirmaria que ninguém acessou dado sigiloso, e a
 *    verdade é que a trilha não distingue. O motivo aparece embaixo da faixa.
 *  - **Coluna de IP**: o protótipo mostra o endereço de cada acesso. A trilha é
 *    escrita por gatilho, dentro do banco, que não enxerga o IP do navegador.
 *  - **Seletor de janela**: o protótipo fixa "24h". Aqui a janela é escolhida,
 *    porque a mesma tela responde "o que aconteceu hoje" e "quem abriu a ficha
 *    desta pessoa nos últimos 90 dias" — a segunda é a pergunta de uma apuração.
 */

const TODOS = "todos";

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

  const filtrada = temRecorte(busca, filtros);
  const semIp = motivoIndisponivel("auditoria.list.ip");

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
      width: "24%",
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
      width: "30%",
      render: (registro) => (
        <div className="min-w-0">
          <p className="text-foreground truncate text-xs">{registro.recurso_label}</p>
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
      render: (registro) => (
        <span className="text-xs">
          {registro.linhas === null ? "—" : formatNumber(registro.linhas)}
        </span>
      ),
    },
    {
      key: "criado_em",
      header: "Quando",
      sortable: true,
      width: 180,
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
        {resumo.isLoading ? (
          <SkeletonCards count={3} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por pessoa, recurso ou paciente…"
          label="Buscar na trilha"
          className="min-w-60 flex-1"
        />

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

        <Select
          value={filtros.acao || TODOS}
          onValueChange={(valor) => setFiltro("acao", valor === TODOS ? "" : valor)}
        >
          <SelectTrigger size="sm" aria-label="Tipo de ação" className="w-40">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Ação: todas</SelectItem>
            {toOptions(ACAO_AUDITORIA_LABEL).map((opcao) => (
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
        {semIp && <BackendPendente titulo="Endereço de IP" motivo={semIp} />}

        <p className="text-muted-foreground text-[11px] leading-relaxed">
          <StatusBadge tone="neutral" size="sm" className="mr-1.5">
            Imutável
          </StatusBadge>
          Registros de auditoria não são alterados nem apagados por nenhuma tela deste painel. A
          exportação em CSV ou JSON atende ao relatório do encarregado de dados — e ela própria fica
          registrada na trilha.
        </p>
      </div>
    </div>
  );
}

export default AuditoriaPage;
