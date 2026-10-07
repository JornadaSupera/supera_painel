import { ArrowDown, ArrowUp } from "lucide-react";

import {
  CatalogFilterSelect,
  FilterChip,
  FilterChipGroup,
  FilterPanel,
  FilterSelect,
  SearchInput,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useCids, useFasesTratamento, useProtocolos } from "@/hooks/useCatalogos";
import { STATUS_PACIENTE_LABEL, toOptions, type Option } from "@/lib/enums";
import { hasActiveFilters } from "@/stores/listStore";
import { useCarteiraStore, type FiltrosCarteira } from "@/stores/clinicoPacientes";

/**
 * Busca, filtros e ordem da carteira de pacientes.
 *
 * A busca fica larga e os filtros atrás do botão "Filtros", como no protótipo;
 * logo abaixo, uma ficha por fase do tratamento — o recorte mais usado, a um
 * clique. As fichas e o seletor de fase escrevem no mesmo filtro.
 *
 * Protocolo, CID e fase vêm dos cadastros: oferecer uma opção que o cadastro não
 * tem devolveria uma lista vazia sem erro. Um seletor cujo cadastro falhou dá
 * lugar ao motivo, porque uma lista vazia por falha de rede é indistinguível de
 * uma lista vazia de verdade.
 */

/** A ordenação que o servidor sabe fazer sobre esta lista, além do nome, que é o padrão. */
const ORDENS: Option[] = [
  { value: "ultima_interacao", label: "Última interação" },
  { value: "criado_em", label: "Cadastro" },
  { value: "cid", label: "CID" },
  { value: "fase", label: "Fase" },
];

export function CarteiraFiltros() {
  const busca = useCarteiraStore((estado) => estado.busca);
  const filtros = useCarteiraStore((estado) => estado.filtros);
  const sort = useCarteiraStore((estado) => estado.sort);
  const setBusca = useCarteiraStore((estado) => estado.setBusca);
  const setFiltro = useCarteiraStore((estado) => estado.setFiltro);
  const setSort = useCarteiraStore((estado) => estado.setSort);
  const limpar = useCarteiraStore((estado) => estado.limparFiltros);

  const cids = useCids();
  const protocolos = useProtocolos();
  const fases = useFasesTratamento();

  const aplicar = (campo: keyof FiltrosCarteira) => (valor: string) => setFiltro(campo, valor);
  const aplicados = Object.values(filtros).filter(Boolean).length;

  const campo = sort?.field ?? "nome";
  const direcao = sort?.direction ?? "asc";

  return (
    <div className="flex flex-col gap-3">
      <FilterPanel
        collapsible
        lead={
          <SearchInput
            value={busca}
            onChange={setBusca}
            placeholder="Buscar por nome, CPF ou código…"
            label="Buscar paciente"
            className="max-w-none min-w-60 flex-1"
          />
        }
        activeCount={aplicados}
        canClear={hasActiveFilters(busca, filtros)}
        onClear={limpar}
      >
        <CatalogFilterSelect
          label="Protocolo"
          errorLabel="A lista de protocolos"
          value={filtros.protocolo_id}
          onChange={aplicar("protocolo_id")}
          options={(protocolos.data ?? []).map((protocolo) => ({
            value: protocolo.id,
            label: protocolo.nome,
          }))}
          isError={protocolos.isError}
          onRetry={() => void protocolos.refetch()}
          className="w-52"
        />

        <CatalogFilterSelect
          label="CID"
          errorLabel="A lista de CIDs"
          value={filtros.cid}
          onChange={aplicar("cid")}
          // Código e descrição juntos: "C50.9" sozinho não diz nada.
          options={(cids.data ?? []).map((cid) => ({
            value: cid.codigo,
            label: `${cid.codigo} · ${cid.descricao}`,
          }))}
          isError={cids.isError}
          onRetry={() => void cids.refetch()}
          className="w-40"
        />

        <CatalogFilterSelect
          label="Fase"
          errorLabel="A lista de fases"
          value={filtros.fase}
          onChange={aplicar("fase")}
          options={fases.data ?? []}
          isError={fases.isError}
          onRetry={() => void fases.refetch()}
          className="w-36"
        />

        <FilterSelect
          label="Situação"
          value={filtros.status}
          onChange={aplicar("status")}
          options={toOptions(STATUS_PACIENTE_LABEL)}
          allLabel="Situação: todas"
          className="w-40"
        />

        <div className="flex items-center gap-1">
          {/* O item vazio do seletor é o nome: sempre há uma ordem. */}
          <FilterSelect
            label="Ordenar por"
            value={campo === "nome" ? "" : campo}
            onChange={(valor) => setSort({ field: valor || "nome", direction: direcao })}
            options={ORDENS}
            allLabel="Ordenar por: nome"
            className="w-44"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8"
            aria-label={direcao === "asc" ? "Ordem crescente. Inverter" : "Ordem decrescente. Inverter"}
            onClick={() => setSort({ field: campo, direction: direcao === "asc" ? "desc" : "asc" })}
          >
            {direcao === "asc" ? <ArrowUp /> : <ArrowDown />}
          </Button>
        </div>
      </FilterPanel>

      {/* Só com o catálogo carregado: uma ficha por fase que o cadastro tem. Se ele
          falhar, o seletor dentro de "Filtros" já diz o motivo. */}
      {fases.data && fases.data.length > 0 && (
        <FilterChipGroup label="Filtrar por fase do tratamento">
          <FilterChip active={!filtros.fase} onClick={() => setFiltro("fase", "")}>
            Todos
          </FilterChip>
          {fases.data.map((fase) => (
            <FilterChip
              key={fase.value}
              active={filtros.fase === fase.value}
              onClick={() => setFiltro("fase", fase.value)}
            >
              {fase.label}
            </FilterChip>
          ))}
        </FilterChipGroup>
      )}
    </div>
  );
}

export default CarteiraFiltros;
