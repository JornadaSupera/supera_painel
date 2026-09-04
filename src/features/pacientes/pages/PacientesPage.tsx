import { Download, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  Can,
  DataTable,
  EmptyState,
  PageHeader,
  StatusBadge,
  TONE_PATIENT_STATUS,
  UserAvatar,
  type Column,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FASE_TRATAMENTO_LABEL, STATUS_PACIENTE_LABEL } from "@/lib/enums";
import { formatNumber, ageInYears } from "@/lib/format";
import { PERMISSAO } from "@/lib/rbac";
import { motivoIndisponivel } from "@/services/apiClient";
import { temRecorte, usePacientesStore } from "@/stores/pacientes";
import type { PacienteListItem } from "@/types/paciente";
import { AcoesPaciente } from "../components/AcoesPaciente";
import { CampoSensivel } from "../components/CampoSensivel";
import { FiltrosPacientes } from "../components/FiltrosPacientes";
import { useExportarPacientes, usePacientes } from "../hooks/usePacientes";

/**
 * Pacientes — listagem.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/pacientes/
 *
 * As cinco colunas, a ordem e o texto do cabeçalho são os do protótipo. Busca,
 * filtros, ordenação e paginação são exigência do escopo contratado e não
 * aparecem lá — seguem a linguagem visual da busca da tela de Usuários.
 *
 * > [!] Toda linha desta tela é dado pessoal de saúde.
 * O CPF nasce mascarado e revelá-lo é uma requisição própria, auditada. Ver
 * `components/CampoSensivel`.
 */
export function PacientesPage() {
  const navigate = useNavigate();

  const { pacientes, total, isLoading, isError, error, refetch, params } = usePacientes();

  const busca = usePacientesStore((estado) => estado.busca);
  const filtros = usePacientesStore((estado) => estado.filtros);
  const sort = usePacientesStore((estado) => estado.sort);
  const page = usePacientesStore((estado) => estado.page);
  const pageSize = usePacientesStore((estado) => estado.pageSize);
  const setSort = usePacientesStore((estado) => estado.setSort);
  const setPage = usePacientesStore((estado) => estado.setPage);
  const setPageSize = usePacientesStore((estado) => estado.setPageSize);

  const exportar = useExportarPacientes(params);
  const filtrada = temRecorte(busca, filtros);

  /*
   * CID e protocolo dependem de uma leitura por paciente, auditada uma a uma.
   * Onde a origem dos dados não os entrega na listagem, a coluna sai inteira:
   * uma coluna sempre vazia se lê como cadastro incompleto, e manda a equipe
   * procurar um dado que nunca esteve ali.
   */
  const semCid = motivoIndisponivel("pacientes.list.cid") !== null;
  const semProtocolo = motivoIndisponivel("pacientes.list.protocolo") !== null;

  const colunas: (Column<PacienteListItem> | false)[] = [
    {
      key: "nome",
      header: "Paciente",
      sortable: true,
      width: "38%",
      render: (paciente) => (
        <div className="flex items-center gap-3">
          <UserAvatar name={paciente.nome} size="sm" className="shrink-0" />

          <div className="min-w-0">
            <p className="text-foreground truncate text-sm font-medium">{paciente.nome}</p>

            <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
              <span className="tabular-nums">{ageInYears(paciente.nascimento)} anos</span>
              <span aria-hidden="true">·</span>
              <span>CPF</span>
              <CampoSensivel
                pacienteId={paciente.id}
                campo="cpf"
                mascarado={paciente.cpf_mascarado}
                nomePaciente={paciente.nome}
              />
            </p>
          </div>
        </div>
      ),
    },
    !semCid && {
      key: "cid",
      header: "CID",
      sortable: true,
      width: "12%",
      render: (paciente) => (
        // O código sozinho não diz nada a quem não é da equipe clínica — a
        // descrição fica no title, sem ocupar coluna.
        <span className="text-muted-foreground text-xs" title={paciente.cid_descricao}>
          {paciente.cid}
        </span>
      ),
    },
    !semProtocolo && {
      key: "protocolo_nome",
      header: "Protocolo",
      width: "20%",
      render: (paciente) => (
        <Badge variant="secondary" className="text-[10px] font-normal">
          {paciente.protocolo_nome}
        </Badge>
      ),
    },
    {
      key: "fase",
      header: "Fase",
      sortable: true,
      width: "14%",
      // Texto simples, como no protótipo: a fase é atributo do tratamento, não
      // um alerta. Transformar em badge daria a ela o mesmo peso do status.
      render: (paciente) => (
        <span className="text-muted-foreground text-xs capitalize">
          {paciente.fase ? FASE_TRATAMENTO_LABEL[paciente.fase] : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      width: 110,
      render: (paciente) => (
        <StatusBadge tone={TONE_PATIENT_STATUS[paciente.status]} size="sm" dot>
          {STATUS_PACIENTE_LABEL[paciente.status]}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: <span className="sr-only">Ações</span>,
      render: (paciente) => <AcoesPaciente paciente={paciente} />,
    },
  ];

  const colunasVisiveis = colunas.filter((coluna): coluna is Column<PacienteListItem> =>
    Boolean(coluna),
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Gestão"
        title="Pacientes"
        level="MVP"
        subtitle={
          isLoading && total === 0
            ? "Carregando cadastro…"
            : `${formatNumber(total)} ${filtrada ? "pacientes no recorte atual" : "pacientes cadastrados"} · convite por SMS no cadastro`
        }
        actions={
          <>
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

            <Can permission={PERMISSAO.PACIENTES_WRITE}>
              <Button
                onClick={() => navigate("/pacientes/novo")}
                disabled={motivoIndisponivel("pacientes.create") !== null}
                title={motivoIndisponivel("pacientes.create") ?? undefined}
              >
                <UserPlus />
                Novo paciente
              </Button>
            </Can>
          </>
        }
      />

      <FiltrosPacientes />

      <div className="bg-card overflow-hidden rounded-2xl border">
        <DataTable
          columns={colunasVisiveis}
          data={pacientes}
          caption="Pacientes cadastrados, com CID, protocolo, fase do tratamento e status."
          label="pacientes"
          loading={isLoading}
          error={isError ? error : null}
          onRetry={() => void refetch()}
          sort={sort}
          onSortChange={setSort}
          filtered={filtrada}
          onRowClick={(paciente) => navigate(`/pacientes/${paciente.id}`)}
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
                  : "Cadastre o primeiro paciente para começar o acompanhamento pelo aplicativo."
              }
              action={
                <Can permission={PERMISSAO.PACIENTES_WRITE}>
                  <Button onClick={() => navigate("/pacientes/novo")}>
                    <UserPlus />
                    Novo paciente
                  </Button>
                </Can>
              }
            />
          }
        />
      </div>
    </div>
  );
}

export default PacientesPage;
