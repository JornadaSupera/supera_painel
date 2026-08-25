import { FilterX } from "lucide-react";

import { SearchInput } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCids, useProtocolos } from "@/hooks/useCatalogos";
import {
  FASE_TRATAMENTO_LABEL,
  RISCO_LABEL,
  STATUS_PACIENTE_LABEL,
  toOptions,
} from "@/lib/enums";
import { usePacientesStore, temRecorte, type FiltrosPacientes as Filtros } from "@/stores/pacientes";

/**
 * Busca e filtros da listagem.
 *
 * O protótipo de Pacientes mostra a tabela sem controles — mas o escopo
 * contratado pede busca por nome, CPF ou código e filtro por protocolo, CID,
 * fase e risco. A barra segue a linguagem visual da busca da tela de Usuários,
 * que é onde o protótipo mostra como esse controle se parece aqui.
 */

/**
 * O <Select> do Radix não aceita item com valor vazio — vazio é como ele marca
 * "nada selecionado". "todos" é o sentinela na interface; o store e a camada de
 * dados continuam falando em string vazia.
 */
const TODOS = "todos";

interface CampoSelectProps {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  opcoes: { value: string; label: string }[];
  larguraClasse?: string;
}

function CampoSelect({ rotulo, valor, onChange, opcoes, larguraClasse }: CampoSelectProps) {
  return (
    <Select value={valor || TODOS} onValueChange={(v) => onChange(v === TODOS ? "" : v)}>
      <SelectTrigger size="sm" aria-label={rotulo} className={larguraClasse}>
        <SelectValue placeholder={rotulo} />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value={TODOS}>{rotulo}: todos</SelectItem>
        {opcoes.map((opcao) => (
          <SelectItem key={opcao.value} value={opcao.value}>
            {opcao.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FiltrosPacientes() {
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
  const comRecorte = temRecorte(busca, filtros);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        value={busca}
        onChange={setBusca}
        placeholder="Buscar por nome, CPF ou código…"
        label="Buscar paciente"
        className="min-w-60 flex-1"
      />

      <CampoSelect
        rotulo="Protocolo"
        valor={filtros.protocolo_id}
        onChange={aplicar("protocolo_id")}
        opcoes={opcoesProtocolo}
        larguraClasse="w-52"
      />

      <CampoSelect
        rotulo="CID"
        valor={filtros.cid}
        onChange={aplicar("cid")}
        opcoes={opcoesCid}
        larguraClasse="w-40"
      />

      <CampoSelect
        rotulo="Fase"
        valor={filtros.fase}
        onChange={aplicar("fase")}
        opcoes={toOptions(FASE_TRATAMENTO_LABEL)}
        larguraClasse="w-36"
      />

      <CampoSelect
        rotulo="Risco"
        valor={filtros.risco}
        onChange={aplicar("risco")}
        opcoes={toOptions(RISCO_LABEL)}
        larguraClasse="w-32"
      />

      <CampoSelect
        rotulo="Status"
        valor={filtros.status}
        onChange={aplicar("status")}
        opcoes={toOptions(STATUS_PACIENTE_LABEL)}
        larguraClasse="w-32"
      />

      {comRecorte && (
        <Button variant="ghost" size="sm" onClick={limparFiltros}>
          <FilterX />
          Limpar
        </Button>
      )}
    </div>
  );
}

export default FiltrosPacientes;
