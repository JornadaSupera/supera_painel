import { ChevronRight, Download } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import {
  Can,
  DataTable,
  EmptyState,
  PageHeader,
  StatusBadge,
  UserAvatar,
  type Column,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useExportarPacientes } from "@/hooks/useExportarPacientes";
import { relativeDay } from "@/lib/agenda";
import {
  ESPECIALIDADE_LABEL,
  FASE_TRATAMENTO_LABEL,
  STATUS_PACIENTE,
  STATUS_PACIENTE_LABEL,
} from "@/lib/enums";
import { ageInYears, formatTime, pluralize, relativeTime } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { useCarteiraStore } from "@/stores/clinicoPacientes";
import { hasActiveFilters } from "@/stores/listStore";
import type { PacienteListItem } from "@/types/paciente";
import { CarteiraFiltros } from "../components/CarteiraFiltros";
import { useMeusPacientes } from "../hooks/useMeusPacientes";

/**
 * Carteira de pacientes — a base compartilhada da equipe, em tabela.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/psicologo/pacientes/
 *
 * A lista é a base compartilhada da equipe — sem recorte por especialidade, ver
 * PA-07 —, a mesma leitura (`read_patient_list`) que o painel administrativo
 * usa. Busca, protocolo, CID, fase, situação, ordem e página são resolvidos no
 * servidor. "Exportar CSV" leva o recorte inteiro, não só a página aberta, e o
 * banco registra a exportação.
 *
 * "Última interação" é a última mensagem que o paciente (ou quem o acompanha)
 * mandou no chat — sob o mesmo sigilo da conversa. Não é "último acesso ao app",
 * que o banco não registra.
 *
 * Sem coluna nem filtro de risco: o risco vem do Gemed, que não está ligado, e
 * um filtro sem fonte devolveria sempre lista vazia.
 */

/** "hoje · 08:00", "ontem · 21:00", "há 3 dias", ou a data depois de uma semana. */
function ultimaInteracao(iso: string | null): string {
  if (!iso) return "Sem mensagens";
  const dia = relativeDay(iso);
  if (dia === "Hoje" || dia === "Ontem") return `${dia.toLowerCase()} · ${formatTime(iso)}`;
  return relativeTime(iso);
}

const COLUNAS: Column<PacienteListItem>[] = [
  {
    key: "nome",
    header: "Paciente",
    sortable: true,
    render: (paciente) => {
      const idade = ageInYears(paciente.nascimento);
      return (
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar name={paciente.nome} size="sm" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate text-sm font-medium">
              <span className="truncate">{paciente.nome}</span>
              {/* The list covers the whole base, deactivated records included. */}
              {paciente.status === STATUS_PACIENTE.INATIVO && (
                <StatusBadge tone="neutral" size="sm">
                  {STATUS_PACIENTE_LABEL[paciente.status]}
                </StatusBadge>
              )}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {[idade !== null ? `${idade} anos` : null, paciente.cid || null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    key: "protocolo",
    header: "Protocolo",
    render: (paciente) =>
      paciente.protocolo_nome !== "—" ? (
        <StatusBadge tone="primary" size="sm" pill>
          {paciente.protocolo_nome}
        </StatusBadge>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "fase",
    header: "Fase",
    sortable: true,
    render: (paciente) => (paciente.fase ? FASE_TRATAMENTO_LABEL[paciente.fase] : "—"),
  },
  {
    key: "ultima_interacao",
    header: "Última interação",
    sortable: true,
    render: (paciente) => (
      <span className={paciente.ultima_interacao_em ? undefined : "text-muted-foreground"}>
        {ultimaInteracao(paciente.ultima_interacao_em)}
      </span>
    ),
  },
  {
    key: "abrir",
    header: <span className="sr-only">Abrir ficha</span>,
    width: 40,
    align: "right",
    render: () => <ChevronRight size={16} aria-hidden="true" className="text-muted-foreground" />,
  },
];

export function ClinicoPacientesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { especialidade } = useParams<{ especialidade: string }>();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const { pacientes, isLoading, isError, error, refetch, total, params } = useMeusPacientes();
  const exportar = useExportarPacientes(params);

  const busca = useCarteiraStore((estado) => estado.busca);
  const filtros = useCarteiraStore((estado) => estado.filtros);
  const sort = useCarteiraStore((estado) => estado.sort);
  const setSort = useCarteiraStore((estado) => estado.setSort);
  const page = useCarteiraStore((estado) => estado.page);
  const pageSize = useCarteiraStore((estado) => estado.pageSize);
  const setPage = useCarteiraStore((estado) => estado.setPage);
  const setPageSize = useCarteiraStore((estado) => estado.setPageSize);

  const filtrada = hasActiveFilters(busca, filtros);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area ? `${area} · Pacientes` : "Pacientes"}
        title="Carteira de pacientes"
        subtitle={
          // A leitura falhou: o total é desconhecido, não zero. "0 pacientes na
          // base" sobre uma lista que não carregou afirma uma base vazia.
          isError
            ? "Não foi possível ler a carteira agora"
            : isLoading && total === 0
              ? "Base compartilhada da equipe"
              : filtrada
                ? `${pluralize(total, "paciente", "pacientes")} no recorte atual`
                : `${pluralize(total, "paciente", "pacientes")} · use filtros para segmentar`
        }
        actions={
          <Can permission={PERMISSAO.PACIENTES_EXPORT}>
            <Button
              variant="outline"
              onClick={() => exportar.mutate()}
              disabled={exportar.isPending || total === 0}
            >
              <Download />
              Exportar CSV
            </Button>
          </Can>
        }
      />

      <CarteiraFiltros />

      {/* Same card as every other listing: the table on its own white surface. */}
      <div className="bg-card overflow-hidden rounded-2xl border">
        <DataTable
          columns={COLUNAS}
          data={pacientes}
          caption="Pacientes da base compartilhada, com protocolo, fase do tratamento e última interação no chat."
          label="pacientes"
          loading={isLoading}
          error={isError ? error : null}
          onRetry={() => void refetch()}
          sort={sort}
          onSortChange={setSort}
          filtered={filtrada}
          onRowClick={(paciente) => navigate(`/clinico/${especialidade}/pacientes/${paciente.id}`)}
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
              title={filtrada ? "Nenhum paciente no recorte" : "Nenhum paciente cadastrado"}
              description={
                filtrada
                  ? "Nenhuma ficha corresponde à busca e aos filtros aplicados."
                  : "Quando a clínica cadastrar pacientes, eles aparecem aqui."
              }
            />
          }
        />
      </div>
    </div>
  );
}

export default ClinicoPacientesPage;
