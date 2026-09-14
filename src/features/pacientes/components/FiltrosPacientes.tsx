import { ClearFiltersButton, FilterSelect, SearchInput } from "@/components/shared";
import { useCids, useProtocolos } from "@/hooks/useCatalogos";
import { motivoIndisponivel } from "@/services/apiClient";
import {
  FASE_TRATAMENTO_LABEL,
  RISCO_LABEL,
  STATUS_PACIENTE_LABEL,
  toOptions,
} from "@/lib/enums";
import { hasActiveFilters } from "@/stores/listStore";
import { usePacientesStore, type FiltrosPacientes as Filtros } from "@/stores/pacientes";

/**
 * Busca e filtros da listagem.
 *
 * O protótipo de Pacientes mostra a tabela sem controles — mas o escopo
 * contratado pede busca por nome, CPF ou código e filtro por protocolo, CID,
 * fase e risco. A barra segue a linguagem visual da busca da tela de Usuários,
 * que é onde o protótipo mostra como esse controle se parece aqui.
 */
export function FiltrosPacientes() {
  // Filtrar por um campo que a listagem não traz devolveria sempre lista vazia,
  // sem erro nenhum — o pior tipo de controle: o que parece funcionar.
  const semCid = motivoIndisponivel("pacientes.list.cid") !== null;
  const semProtocolo = motivoIndisponivel("pacientes.list.protocolo") !== null;
  const semRisco = motivoIndisponivel("pacientes.list.risco") !== null;

  const busca = usePacientesStore((estado) => estado.busca);
  const filtros = usePacientesStore((estado) => estado.filtros);
  const setBusca = usePacientesStore((estado) => estado.setBusca);
  const setFiltro = usePacientesStore((estado) => estado.setFiltro);
  const limparFiltros = usePacientesStore((estado) => estado.limparFiltros);

  const cids = useCids();
  const protocolos = useProtocolos();

  const opcoesCid = (cids.data ?? []).map((cid) => ({
    value: cid.codigo,
    // Código e descrição juntos: "C50.9" sozinho não diz nada a quem não é da
    // equipe clínica.
    label: `${cid.codigo} · ${cid.descricao}`,
  }));

  const opcoesProtocolo = (protocolos.data ?? []).map((protocolo) => ({
    value: protocolo.id,
    label: protocolo.nome,
  }));

  const aplicar = (campo: keyof Filtros) => (valor: string) => setFiltro(campo, valor);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        value={busca}
        onChange={setBusca}
        placeholder="Buscar por nome, CPF ou código…"
        label="Buscar paciente"
        className="min-w-60 flex-1"
      />

      {!semProtocolo && (
        <FilterSelect
          label="Protocolo"
          value={filtros.protocolo_id}
          onChange={aplicar("protocolo_id")}
          options={opcoesProtocolo}
          className="w-52"
        />
      )}

      {!semCid && (
        <FilterSelect
          label="CID"
          value={filtros.cid}
          onChange={aplicar("cid")}
          options={opcoesCid}
          className="w-40"
        />
      )}

      <FilterSelect
        label="Fase"
        value={filtros.fase}
        onChange={aplicar("fase")}
        options={toOptions(FASE_TRATAMENTO_LABEL)}
        className="w-36"
      />

      {!semRisco && (
        <FilterSelect
          label="Risco"
          value={filtros.risco}
          onChange={aplicar("risco")}
          options={toOptions(RISCO_LABEL)}
          className="w-32"
        />
      )}

      <FilterSelect
        label="Status"
        value={filtros.status}
        onChange={aplicar("status")}
        options={toOptions(STATUS_PACIENTE_LABEL)}
        className="w-32"
      />

      <ClearFiltersButton visible={hasActiveFilters(busca, filtros)} onClick={limparFiltros} />
    </div>
  );
}

export default FiltrosPacientes;
