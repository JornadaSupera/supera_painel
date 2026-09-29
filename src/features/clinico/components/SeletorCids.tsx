import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCids } from "@/hooks/useCatalogos";

/**
 * A marcação por CID-10 da orientação.
 *
 * Lista vazia quer dizer orientação universal: ela chega a todo paciente. Com
 * CIDs marcados, chega só a quem tem um deles — e é por isso que a marcação é
 * explícita e visível, não um campo que se preenche por hábito.
 */

const LIMITE_DA_LISTA = 40;

export function SeletorCids({
  value,
  onChange,
  disabled,
}: {
  value: string[];
  onChange: (codigos: string[]) => void;
  disabled?: boolean;
}) {
  const cids = useCids();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");

  const descricaoPorCodigo = useMemo(
    () => new Map((cids.data ?? []).map((cid) => [cid.codigo, cid.descricao])),
    [cids.data],
  );

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const todos = cids.data ?? [];
    const filtrados = termo
      ? todos.filter(
          (cid) =>
            cid.codigo.toLowerCase().includes(termo) || cid.descricao.toLowerCase().includes(termo),
        )
      : todos;

    return filtrados.slice(0, LIMITE_DA_LISTA);
  }, [busca, cids.data]);

  const alternar = (codigo: string) =>
    onChange(value.includes(codigo) ? value.filter((c) => c !== codigo) : [...value, codigo]);

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Sem CID marcado: a orientação chega a todos os pacientes.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((codigo) => (
            <li
              key={codigo}
              className="bg-muted flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs"
            >
              <span className="font-mono">{codigo}</span>
              <span className="text-muted-foreground max-w-48 truncate">
                {descricaoPorCodigo.get(codigo)}
              </span>
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Remover ${codigo}`}
                  onClick={() => alternar(codigo)}
                  className="hover:bg-background rounded-full p-0.5"
                >
                  <X className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <Popover open={aberto} onOpenChange={setAberto}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="self-start">
              <Plus />
              Marcar CID
            </Button>
          </PopoverTrigger>

          <PopoverContent align="start" className="w-96 max-w-[90vw] p-2">
            <Input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar por código ou nome"
              aria-label="Buscar CID"
              autoFocus
            />

            <ul role="listbox" aria-label="CIDs" className="mt-2 max-h-64 overflow-y-auto">
              {cids.isLoading && <li className="text-muted-foreground p-2 text-xs">Carregando…</li>}
              {cids.isError && (
                <li className="text-destructive p-2 text-xs">Não foi possível carregar os CIDs.</li>
              )}
              {!cids.isLoading && !cids.isError && resultados.length === 0 && (
                <li className="text-muted-foreground p-2 text-xs">Nenhum CID encontrado.</li>
              )}

              {resultados.map((cid) => {
                const marcado = value.includes(cid.codigo);

                return (
                  <li key={cid.codigo} role="option" aria-selected={marcado}>
                    <button
                      type="button"
                      onClick={() => alternar(cid.codigo)}
                      className="hover:bg-muted flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        readOnly
                        tabIndex={-1}
                        aria-hidden
                        className="mt-1"
                      />
                      <span className="font-mono text-xs">{cid.codigo}</span>
                      <span className="text-muted-foreground min-w-0 flex-1 text-xs">
                        {cid.descricao}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default SeletorCids;
