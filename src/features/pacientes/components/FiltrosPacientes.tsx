import {
  ClearFiltersButton,
  FilterSelect,
  SearchInput,
  SourceErrorChip,
} from "@/components/shared";
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        value={busca}
        onChange={setBusca}
        placeholder="Buscar por nome, CPF ou código…"
        label="Buscar paciente"
        className="min-w-60 flex-1"
      />

      {/* Seletor cujo catálogo falhou some e dá lugar ao motivo: uma lista
          vazia por erro de rede é indistinguível de uma lista vazia legítima, e
          quem vê "Protocolo: todos" sem opção nenhuma conclui que a clínica não
          tem protocolo cadastrado. */}
      {!semProtocolo &&
        (protocolos.isError ? (
          <SourceErrorChip
            label="A lista de protocolos"
            onRetry={() => void protocolos.refetch()}
          />
        ) : (
          <FilterSelect
            label="Protocolo"
            value={filtros.protocolo_id}
            onChange={aplicar("protocolo_id")}
            options={opcoesProtocolo}
            className="w-52"
          />
        ))}

      {!semCid &&
        (cids.isError ? (
          <SourceErrorChip label="A lista de CIDs" onRetry={() => void cids.refetch()} />
        ) : (
          <FilterSelect
            label="CID"
            value={filtros.cid}
            onChange={aplicar("cid")}
            options={opcoesCid}
            className="w-40"
          />
        ))}

      {/* As fases vêm do cadastro, não do vocabulário do painel: oferecer uma
          fase que o catálogo não tem é um filtro que só devolve lista vazia, e
          quem filtra entende "não há paciente nessa fase" em vez de "essa fase
          não existe aqui". */}
      {fases.isError ? (
        <SourceErrorChip label="A lista de fases" onRetry={() => void fases.refetch()} />
      ) : (
        <FilterSelect
          label="Fase"
          value={filtros.fase}
          onChange={aplicar("fase")}
          options={fases.data ?? []}
          className="w-36"
        />
      )}

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
