import { Download } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import {
  Can,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SkeletonCards,
  StatusBadge,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useExportarPacientes } from "@/hooks/useExportarPacientes";
import {
  ESPECIALIDADE_LABEL,
  FASE_TRATAMENTO_LABEL,
  RISCO_LABEL,
  STATUS_PACIENTE,
  STATUS_PACIENTE_LABEL,
} from "@/lib/enums";
import { pluralize } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { useCarteiraStore } from "@/stores/clinicoPacientes";
import { hasActiveFilters } from "@/stores/listStore";
import { CarteiraFiltros } from "../components/CarteiraFiltros";
import { useMeusPacientes } from "../hooks/useMeusPacientes";

/**
 * Carteira de pacientes.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/farmaceutico/pacientes/
 *
 * A lista é a base compartilhada da equipe — sem recorte por especialidade, ver
 * PA-07 —, a mesma leitura (`read_patient_list`) que o painel administrativo
 * usa. Busca, protocolo, CID, fase, situação, ordem e página são resolvidos no
 * servidor. "Exportar CSV" leva o recorte inteiro, não só a página aberta, e o
 * banco registra a exportação.
 *
 * Sem filtro por risco: não há fonte para ele (é decisão do cliente e depende
 * do banco), e um filtro sem fonte devolveria sempre lista vazia.
 *
 * O clique abre a ficha do administrativo, montada dentro deste painel
 * (`pacientes/:id`).
 */
export function ClinicoPacientesPage() {
  const { user } = useAuth();
  const { especialidade } = useParams<{ especialidade: string }>();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const { pacientes, isLoading, isError, error, refetch, total, params } = useMeusPacientes();
  const exportar = useExportarPacientes(params);

  const busca = useCarteiraStore((estado) => estado.busca);
  const filtros = useCarteiraStore((estado) => estado.filtros);
  const page = useCarteiraStore((estado) => estado.page);
  const pageSize = useCarteiraStore((estado) => estado.pageSize);
  const setPage = useCarteiraStore((estado) => estado.setPage);
  const setPageSize = useCarteiraStore((estado) => estado.setPageSize);

  const filtrada = hasActiveFilters(busca, filtros);
  const vazio = !isLoading && !isError && pacientes.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title="Pacientes"
        subtitle={
          isLoading && total === 0
            ? "Carteira de pacientes"
            : filtrada
              ? `${pluralize(total, "paciente", "pacientes")} no recorte atual`
              : `${pluralize(total, "paciente", "pacientes")} na base compartilhada da equipe`
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

      {isLoading && <SkeletonCards count={4} />}

      {isError && <ErrorState error={error} onRetry={refetch} />}

      {vazio && (
        <EmptyState
          variant={filtrada ? "search" : "empty"}
          title={filtrada ? "Nenhum paciente no recorte" : "Nenhum paciente cadastrado"}
          description={
            filtrada
              ? "Nenhuma ficha corresponde à busca e aos filtros aplicados."
              : "Quando a clínica cadastrar pacientes, eles aparecem aqui."
          }
        />
      )}

      <div className="flex flex-col gap-2">
        {pacientes.map((paciente) => (
          <Link
            key={paciente.id}
            to={`/clinico/${especialidade}/pacientes/${paciente.id}`}
            className="bg-card hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-4 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">{paciente.nome}</p>
              <p className="text-muted-foreground truncate text-xs">
                {paciente.codigo}
                {paciente.cid && paciente.cid !== "—" ? ` · ${paciente.cid} — ${paciente.cid_descricao}` : ""}
                {paciente.protocolo_nome !== "—" ? ` · ${paciente.protocolo_nome}` : ""}
              </p>
            </div>

            {/* The list covers the whole base, deactivated records included —
                a card that looks like any other made an inactive patient read
                as one under care. */}
            {paciente.status === STATUS_PACIENTE.INATIVO && (
              <StatusBadge tone="neutral" size="sm">
                {STATUS_PACIENTE_LABEL[paciente.status]}
              </StatusBadge>
            )}

            {paciente.fase && (
              <StatusBadge tone="neutral" size="sm">
                {FASE_TRATAMENTO_LABEL[paciente.fase]}
              </StatusBadge>
            )}

            {paciente.risco && (
              <StatusBadge
                tone={paciente.risco === "alto" ? "danger" : paciente.risco === "medio" ? "warning" : "neutral"}
                size="sm"
              >
                Risco {RISCO_LABEL[paciente.risco].toLowerCase()}
              </StatusBadge>
            )}
          </Link>
        ))}
      </div>

      {total > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          count={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          label="pacientes"
          className="rounded-2xl border"
        />
      )}
    </div>
  );
}

export default ClinicoPacientesPage;
