import { useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorState, PageHeader, SearchInput, SkeletonCards, StatusBadge } from "@/components/shared";
import { useAuth } from "@/contexts/auth-context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ESPECIALIDADE_LABEL, FASE_TRATAMENTO_LABEL, RISCO_LABEL } from "@/lib/enums";
import { useMeusPacientes } from "../hooks/useMeusPacientes";

/**
 * Carteira de pacientes.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/farmaceutico/pacientes/
 *
 * A lista é a mesma dos 40 pacientes que o protótipo mostra idêntica nos três
 * perfis (farmacêutico, psicólogo, médico) — sem filtro por especialidade, ver
 * PA-07. É a mesma leitura (`read_patient_list`) que o painel administrativo
 * já usa, só sem o painel de filtros dele: aqui é busca simples.
 *
 * A ficha do paciente ainda não existe neste painel: o clique abre a ficha do
 * administrativo (`/pacientes/:id`), que o profissional já pode ler.
 */
export function ClinicoPacientesPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const [busca, setBusca] = useState("");
  const buscaEstavel = useDebouncedValue(busca);
  const { pacientes, isLoading, isError, error, refetch, total } = useMeusPacientes(buscaEstavel);

  const filtrada = buscaEstavel.length > 0;
  const vazio = !isLoading && !isError && pacientes.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title="Pacientes"
        subtitle={
          !isLoading && !isError
            ? filtrada
              ? `${total} ${total === 1 ? "paciente encontrado" : "pacientes encontrados"}`
              : `${total} ${total === 1 ? "paciente" : "pacientes"} na base compartilhada da equipe`
            : "Carteira de pacientes"
        }
      />

      <SearchInput
        value={busca}
        onChange={setBusca}
        placeholder="Buscar por nome, CPF ou código…"
        label="Buscar paciente"
        className="max-w-sm"
      />

      {isLoading && <SkeletonCards count={4} />}

      {isError && <ErrorState error={error} onRetry={refetch} />}

      {vazio && (
        <EmptyState
          variant={filtrada ? "search" : "empty"}
          title={filtrada ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
          description={
            filtrada
              ? "Nenhum paciente corresponde à busca."
              : "Quando a clínica cadastrar pacientes, eles aparecem aqui."
          }
        />
      )}

      <div className="flex flex-col gap-2">
        {pacientes.map((paciente) => (
          <Link
            key={paciente.id}
            to={`/pacientes/${paciente.id}`}
            className="bg-card hover:bg-muted/50 focus-visible:ring-ring flex items-center gap-4 rounded-2xl border p-4 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">{paciente.nome}</p>
              <p className="text-muted-foreground truncate text-xs">
                {paciente.codigo} · {paciente.cid} — {paciente.cid_descricao}
                {paciente.protocolo_nome !== "—" ? ` · ${paciente.protocolo_nome}` : ""}
              </p>
            </div>

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
    </div>
  );
}

export default ClinicoPacientesPage;
