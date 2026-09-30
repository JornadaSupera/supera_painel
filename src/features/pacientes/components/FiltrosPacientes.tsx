import { CatalogFilterSelect, FilterPanel, FilterSelect, SearchInput } from "@/components/shared";
import { useCids, useFasesTratamento, useProtocolos } from "@/hooks/useCatalogos";
import { motivoIndisponivel } from "@/services/apiClient";
import { RISCO_LABEL, STATUS_PACIENTE_LABEL, toOptions } from "@/lib/enums";
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
  /*
   * Filtrar por um campo que a origem não oferece devolveria sempre lista vazia,
   * sem erro nenhum — o pior tipo de controle: o que parece funcionar.
   *
   * O filtro por protocolo tem uma ausência própria, e por isso a chave é outra:
   * o backend ACEITA o filtro, o que não existe é catálogo de protocolos para
   * oferecer no seletor. Um `<Select>` sem opção nenhuma é o mesmo beco.
   */
  const semCid = motivoIndisponivel("pacientes.list.cid") !== null;
  const semProtocolo = motivoIndisponivel("pacientes.filter.protocolo") !== null;
  const semRisco = motivoIndisponivel("pacientes.list.risco") !== null;

  const busca = usePacientesStore((estado) => estado.busca);
  const filtros = usePacientesStore((estado) => estado.filtros);
  const setBusca = usePacientesStore((estado) => estado.setBusca);
  const setFiltro = usePacientesStore((estado) => estado.setFiltro);
  const limparFiltros = usePacientesStore((estado) => estado.limparFiltros);

  const cids = useCids();
  const protocolos = useProtocolos();
  const fases = useFasesTratamento();

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
  const aplicados = Object.values(filtros).filter(Boolean).length;

  return (
    <FilterPanel
      lead={
        <SearchInput
          value={busca}
          onChange={setBusca}
          placeholder="Buscar por nome, CPF ou código…"
          label="Buscar paciente"
          className="min-w-60 flex-1"
        />
      }
      activeCount={aplicados}
      canClear={hasActiveFilters(busca, filtros)}
      onClear={limparFiltros}
    >
      {/* Seletor cujo catálogo falhou dá lugar ao motivo: uma lista vazia por erro
          de rede é indistinguível de uma lista vazia legítima. */}
      {!semProtocolo && (
        <CatalogFilterSelect
          label="Protocolo"
          errorLabel="A lista de protocolos"
          value={filtros.protocolo_id}
          onChange={aplicar("protocolo_id")}
          options={opcoesProtocolo}
          isError={protocolos.isError}
          onRetry={() => void protocolos.refetch()}
          className="w-52"
        />
      )}

      {!semCid && (
        <CatalogFilterSelect
          label="CID"
          errorLabel="A lista de CIDs"
          value={filtros.cid}
          onChange={aplicar("cid")}
          options={opcoesCid}
          isError={cids.isError}
          onRetry={() => void cids.refetch()}
          className="w-40"
        />
      )}

      {/* As fases vêm do cadastro, não do vocabulário do painel: oferecer uma
          fase que o catálogo não tem é um filtro que só devolve lista vazia. */}
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

      {/* w-36, not w-32: at 128px "Status: todos" was cut to "Status: todo". */}
      {!semRisco && (
        <FilterSelect
          label="Risco"
          value={filtros.risco}
          onChange={aplicar("risco")}
          options={toOptions(RISCO_LABEL)}
          className="w-36"
        />
      )}

      <FilterSelect
        label="Status"
        value={filtros.status}
        onChange={aplicar("status")}
        options={toOptions(STATUS_PACIENTE_LABEL)}
        className="w-36"
      />
    </FilterPanel>
  );
}

export default FiltrosPacientes;
