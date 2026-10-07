import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCriarSintoma } from "../hooks/useConfiguracoes";

/** The name needs a letter: the code the diary uses is derived from it. */
const nomeSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do sintoma.")
  .max(60, "Nome muito longo.")
  .regex(/\p{L}/u, "O nome precisa ter letras.");

/**
 * A new symptom, at the foot of the "Sintomas do diário" list.
 *
 * Only the name and the group. The technical code comes from the name, in the
 * data layer, and never shows here: whoever registers thinks of the symptom,
 * not of its identifier.
 */
export function NovoSintoma() {
  const criar = useCriarSintoma();
  const id = useId();

  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [psicologico, setPsicologico] = useState(false);
  // The message waits for the first submit: an empty field is not an error
  // while the person is still about to type.
  const [enviado, setEnviado] = useState(false);

  const validacao = nomeSchema.safeParse(nome);
  const erro = enviado && !validacao.success ? (validacao.error.issues[0]?.message ?? null) : null;

  const fechar = () => {
    setAberto(false);
    setNome("");
    setPsicologico(false);
    setEnviado(false);
  };

  if (!aberto) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-primary-ink -ml-2 w-fit"
        onClick={() => setAberto(true)}
      >
        <Plus />
        Novo sintoma
      </Button>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        setEnviado(true);
        if (!validacao.success) return;

        criar.mutate({ label: validacao.data, psicologico }, { onSuccess: fechar });
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-nome`} className="text-xs">
          Nome do sintoma
        </Label>
        <Input
          id={`${id}-nome`}
          value={nome}
          maxLength={60}
          placeholder="Dor de cabeça"
          autoFocus
          aria-invalid={erro !== null}
          aria-describedby={`${id}-nome-ajuda`}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <p
          id={`${id}-nome-ajuda`}
          className={erro ? "text-destructive text-[11px]" : "text-muted-foreground text-[11px]"}
        >
          {erro ?? "Como aparece para o paciente no diário. Entra no fim da lista."}
        </p>
      </div>

      <div className="flex items-start gap-2">
        <Checkbox
          id={`${id}-psicologico`}
          checked={psicologico}
          onCheckedChange={(marcado) => setPsicologico(marcado === true)}
          className="mt-0.5"
        />
        <div className="grid gap-0.5">
          <Label htmlFor={`${id}-psicologico`} className="text-xs">
            Sintoma psicológico
          </Label>
          <p className="text-muted-foreground text-[11px]">
            Coloca o sintoma no grupo psicológico, e não no físico.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={fechar}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={criar.isPending}>
          {criar.isPending ? "Cadastrando…" : "Cadastrar sintoma"}
        </Button>
      </div>
    </form>
  );
}

export default NovoSintoma;
