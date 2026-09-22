import { useState } from "react";

import { Check, Pencil, Plus, X } from "lucide-react";

import { EmptyState, ErrorState, SkeletonCards } from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MotivoSituacao } from "@/types/configuracao";
import {
  useAtualizarMotivo,
  useCriarMotivo,
  useMotivos,
  useSetMotivoAtivo,
} from "../hooks/useConfiguracoes";

/**
 * Motivos de falta, cancelamento, remarcação e realização.
 *
 * É o recorte que transforma "houve 38 faltas" em algo acionável — sem ele o
 * relatório conta quantas houve e não diz por quê, que é a única parte sobre a
 * qual a clínica consegue agir.
 *
 * > [!] Só situação terminal aceita motivo.
 * "Agendado" não se explica por um motivo, e o backend recusa o par. O seletor
 * oferece apenas as quatro que aceitam, em vez de deixar escolher e falhar no
 * fim.
 *
 * > [!] Aposentar é porta de mão única, e a tela avisa antes.
 * A política de leitura da tabela é `is_active`: aposentado fica invisível a
 * quem faz login, então o painel não consegue nem listar nem reativar. É por
 * isso que **corrigir o rótulo** está aqui, à mão: consertar uma digitação não
 * pode exigir aposentar e recadastrar.
 *
 * O código, esse não muda — os compromissos já registrados apontam para ele, e
 * é ele que o relatório agrupa.
 */

/** As situações terminais do backend, na ordem em que a recepção as usa. */
const SITUACOES = [
  { codigo: "no_show", label: "Falta" },
  { codigo: "cancelled", label: "Cancelado" },
  { codigo: "rescheduled", label: "Remarcado" },
  { codigo: "completed", label: "Realizado" },
] as const;

/** O mesmo formato que o backend exige, dito antes de a pessoa errar. */
const CODIGO_VALIDO = /^[a-z0-9_]+$/;

/** "Paciente sem transporte" → `paciente_sem_transporte`. */
function sugerirCodigo(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function FormularioMotivo({ onPronto }: { onPronto: () => void }) {
  const criar = useCriarMotivo();

  const [situacao, setSituacao] = useState<string>(SITUACOES[0].codigo);
  const [label, setLabel] = useState("");
  const [codigo, setCodigo] = useState("");
  // Enquanto ninguém editar o código à mão, ele acompanha o rótulo. Depois de
  // editado, para de acompanhar: sobrescrever o que a pessoa digitou é pior do
  // que exigir que ela complete.
  const [codigoTocado, setCodigoTocado] = useState(false);

  const codigoFinal = codigoTocado ? codigo : sugerirCodigo(label);
  const codigoInvalido = codigoFinal !== "" && !CODIGO_VALIDO.test(codigoFinal);
  const podeSalvar = label.trim() !== "" && codigoFinal !== "" && !codigoInvalido;

  return (
    <form
      className="bg-card flex flex-col gap-3 rounded-2xl border p-5"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!podeSalvar) return;

        criar.mutate(
          { situacao_codigo: situacao, codigo: codigoFinal, label: label.trim() },
          {
            onSuccess: () => {
              setLabel("");
              setCodigo("");
              setCodigoTocado(false);
              onPronto();
            },
          },
        );
      }}
    >
      <h3 className="text-foreground text-sm font-semibold">Novo motivo</h3>

      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motivo-situacao" className="text-xs">
            Situação
          </Label>

          <Select value={situacao} onValueChange={setSituacao}>
            <SelectTrigger id="motivo-situacao" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SITUACOES.map((item) => (
                <SelectItem key={item.codigo} value={item.codigo}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="motivo-label" className="text-xs">
            Como aparece para quem registra
          </Label>
          <Input
            id="motivo-label"
            value={label}
            maxLength={60}
            placeholder="Paciente sem transporte"
            onChange={(evento) => setLabel(evento.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="motivo-codigo" className="text-xs">
          Código
        </Label>
        <Input
          id="motivo-codigo"
          value={codigoFinal}
          className="font-mono text-xs"
          aria-invalid={codigoInvalido}
          aria-describedby="motivo-codigo-ajuda"
          onChange={(evento) => {
            setCodigoTocado(true);
            setCodigo(evento.target.value);
          }}
        />
        <p id="motivo-codigo-ajuda" className="text-muted-foreground text-[11px]">
          {codigoInvalido
            ? "Só minúsculas, dígitos e underscore — é o formato que o backend aceita."
            : "Identificador fixo do motivo. Não muda depois, porque os relatórios antigos apontam para ele."}
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onPronto}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={!podeSalvar || criar.isPending}>
          {criar.isPending ? "Cadastrando…" : "Cadastrar motivo"}
        </Button>
      </div>
    </form>
  );
}

/** Uma linha de motivo: rótulo corrigível no lugar, código fixo ao lado. */
function LinhaMotivo({
  motivo,
  onAposentar,
}: {
  motivo: MotivoSituacao;
  onAposentar: () => void;
}) {
  const atualizar = useAtualizarMotivo();
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(motivo.label);

  const salvar = () => {
    const label = rascunho.trim();
    if (!label || label === motivo.label) return setEditando(false);

    atualizar.mutate({ id: motivo.id, label }, { onSuccess: () => setEditando(false) });
  };

  return (
    <li className="flex items-center justify-between gap-3 py-2">
      {editando ? (
        <Input
          autoFocus
          value={rascunho}
          maxLength={60}
          className="h-8 text-xs"
          aria-label={`Rótulo de ${motivo.codigo}`}
          onChange={(evento) => setRascunho(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter") salvar();
            if (evento.key === "Escape") {
              setRascunho(motivo.label);
              setEditando(false);
            }
          }}
        />
      ) : (
        <div className="min-w-0">
          <p className="text-foreground truncate text-xs font-medium">{motivo.label}</p>
          <code className="text-muted-foreground font-mono text-[10px]">{motivo.codigo}</code>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {editando ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Salvar rótulo"
              disabled={atualizar.isPending}
              onClick={salvar}
            >
              <Check />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Cancelar edição"
              onClick={() => {
                setRascunho(motivo.label);
                setEditando(false);
              }}
            >
              <X />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Corrigir o rótulo de ${motivo.label}`}
              onClick={() => setEditando(true)}
            >
              <Pencil />
            </Button>
            <Button variant="ghost" size="sm" onClick={onAposentar}>
              Aposentar
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function Grupo({
  situacao,
  motivos,
  onAposentar,
}: {
  situacao: string;
  motivos: MotivoSituacao[];
  onAposentar: (motivo: MotivoSituacao) => void;
}) {
  return (
    <section className="bg-card rounded-2xl border p-5">
      <header className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-foreground text-sm font-semibold">{situacao}</h3>
        <span className="text-muted-foreground text-[11px] tabular-nums">
          {motivos.length} em uso
        </span>
      </header>

      <ul className="divide-border divide-y">
        {motivos.map((motivo) => (
          <LinhaMotivo
            key={motivo.id}
            motivo={motivo}
            onAposentar={() => onAposentar(motivo)}
          />
        ))}
      </ul>
    </section>
  );
}

export function MotivosSituacao() {
  const motivos = useMotivos();
  const aposentar = useSetMotivoAtivo();
  const [cadastrando, setCadastrando] = useState(false);
  // O motivo aguardando confirmação de aposentadoria. `null` = nenhum.
  const [aposentando, setAposentando] = useState<MotivoSituacao | null>(null);

  if (motivos.isLoading) return <SkeletonCards count={2} />;

  if (motivos.isError) {
    return <ErrorState error={motivos.error} onRetry={() => void motivos.refetch()} />;
  }

  const lista = motivos.data ?? [];

  const porSituacao = SITUACOES.map((situacao) => ({
    ...situacao,
    itens: lista.filter((motivo) => motivo.situacao_codigo === situacao.codigo),
  })).filter((grupo) => grupo.itens.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-muted-foreground max-w-[70ch] text-xs leading-relaxed">
          Por que um compromisso não aconteceu. É o que o relatório de faltas usa para dizer{" "}
          <strong className="text-foreground font-medium">por quê</strong>, e não apenas quantas —
          a única parte sobre a qual dá para agir.
        </p>

        {!cadastrando && (
          <Button size="sm" className="shrink-0" onClick={() => setCadastrando(true)}>
            <Plus />
            Novo motivo
          </Button>
        )}
      </div>

      {cadastrando && <FormularioMotivo onPronto={() => setCadastrando(false)} />}

      {lista.length === 0 ? (
        <EmptyState
          title="Nenhum motivo cadastrado"
          description="Sem motivos, o relatório de faltas conta quantas houve e não diz por quê. A lista sai de uma conversa com a recepção: os motivos que ela já usa no dia a dia."
          action={
            cadastrando ? undefined : (
              <Button size="sm" onClick={() => setCadastrando(true)}>
                <Plus />
                Cadastrar o primeiro
              </Button>
            )
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {porSituacao.map((grupo) => (
            <Grupo
              key={grupo.codigo}
              situacao={grupo.label}
              motivos={grupo.itens}
              onAposentar={setAposentando}
            />
          ))}
        </div>
      )}

      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Motivo se aposenta, nunca se apaga: um compromisso de março aponta para o motivo de março, e
        apagar a linha falsificaria o relatório daquele mês. Para corrigir uma digitação, use o
        lápis — o rótulo muda e o código, que é o que os relatórios agrupam, continua o mesmo.
      </p>

      {/* Confirmação sem campo de motivo, de propósito: a justificativa não tem
          onde ser gravada no backend, e pedir um texto que não chega a lugar
          nenhum é pior do que não pedir. O que importa aqui é o aviso de que
          não há volta. */}
      <AlertDialog
        open={aposentando !== null}
        onOpenChange={(estado) => {
          if (!estado) setAposentando(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aposentar “{aposentando?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              O motivo sai da lista e deixa de ser oferecido em compromissos novos. Os compromissos
              já registrados continuam explicados por ele.
              <strong className="text-foreground mt-2 block font-medium">
                O painel não consegue trazê-lo de volta: a partir daqui, só quem administra o banco
                de dados o enxerga.
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={aposentar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={aposentar.isPending}
              onClick={() => {
                if (aposentando) aposentar.mutate({ id: aposentando.id, ativo: false });
                setAposentando(null);
              }}
            >
              Aposentar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default MotivosSituacao;
