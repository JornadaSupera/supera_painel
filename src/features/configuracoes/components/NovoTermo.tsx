import { Plus } from "lucide-react";
import { useId, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ESPECIALIDADE_LABEL, type Especialidade, type VocabularioCriavel } from "@/lib/enums";
import { useCriarTermoVocabulario } from "../hooks/useConfiguracoes";

/** The name needs a letter: the code the system uses is derived from it. */
const nomeSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(60, "Nome muito longo.")
  .regex(/\p{L}/u, "O nome precisa ter letras.");

const AREAS = Object.keys(ESPECIALIDADE_LABEL) as Especialidade[];

/** "Any area" in the subject's select: the general queue. */
const QUALQUER_AREA = "qualquer";

/** What changes from one vocabulary to the next: the words, and the one extra field. */
const TEXTO: Record<
  VocabularioCriavel,
  { botao: string; nome: string; exemplo: string; ajuda: string; salvar: string }
> = {
  symptoms: {
    botao: "Novo sintoma",
    nome: "Nome do sintoma",
    exemplo: "Dor de cabeça",
    ajuda: "Como aparece para o paciente no diário. Entra no fim da lista.",
    salvar: "Cadastrar sintoma",
  },
  conversation_subjects: {
    botao: "Novo assunto",
    nome: "Nome do assunto",
    exemplo: "Dúvida sobre medicação",
    ajuda: "O que o paciente escolhe ao abrir uma conversa. Entra no fim da lista.",
    salvar: "Cadastrar assunto",
  },
  content_categories: {
    botao: "Nova categoria",
    nome: "Nome da categoria",
    exemplo: "Alimentação na quimioterapia",
    ajuda: "Um chip de filtro da biblioteca de orientações. Entra no fim da lista.",
    salvar: "Cadastrar categoria",
  },
  appointment_types: {
    botao: "Novo tipo",
    nome: "Nome do tipo de compromisso",
    exemplo: "Teleconsulta",
    ajuda: "Uma opção de tipo na agenda. Entra no fim da lista.",
    salvar: "Cadastrar tipo",
  },
};

/**
 * A new term, at the foot of a catalog card.
 *
 * The name, plus what the vocabulary needs: the group of a symptom, the area
 * that produces a content category, the area that answers a chat subject. The
 * technical code comes from the name, in the data layer, and never shows here.
 */
export function NovoTermo({ vocabulario }: { vocabulario: VocabularioCriavel }) {
  const criar = useCriarTermoVocabulario();
  const id = useId();
  const texto = TEXTO[vocabulario];

  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [psicologico, setPsicologico] = useState(false);
  const [area, setArea] = useState<string>("");
  // The messages wait for the first submit: an empty field is not an error
  // while the person is still about to type.
  const [enviado, setEnviado] = useState(false);

  const pedeArea = vocabulario === "content_categories" || vocabulario === "conversation_subjects";
  const areaObrigatoria = vocabulario === "content_categories";

  const validacao = nomeSchema.safeParse(nome);
  const erroNome =
    enviado && !validacao.success ? (validacao.error.issues[0]?.message ?? null) : null;
  const erroArea = enviado && areaObrigatoria && !area ? "Escolha a área." : null;

  const fechar = () => {
    setAberto(false);
    setNome("");
    setPsicologico(false);
    setArea("");
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
        {texto.botao}
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
        if (!validacao.success || (areaObrigatoria && !area)) return;

        criar.mutate(
          {
            vocabulario,
            label: validacao.data,
            psicologico,
            especialidade: area && area !== QUALQUER_AREA ? (area as Especialidade) : null,
          },
          { onSuccess: fechar },
        );
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-nome`} className="text-xs">
          {texto.nome}
        </Label>
        <Input
          id={`${id}-nome`}
          value={nome}
          maxLength={60}
          placeholder={texto.exemplo}
          autoFocus
          aria-invalid={erroNome !== null}
          aria-describedby={`${id}-nome-ajuda`}
          onChange={(evento) => setNome(evento.target.value)}
        />
        <p
          id={`${id}-nome-ajuda`}
          className={
            erroNome ? "text-destructive text-[11px]" : "text-muted-foreground text-[11px]"
          }
        >
          {erroNome ?? texto.ajuda}
        </p>
      </div>

      {vocabulario === "symptoms" && (
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
      )}

      {pedeArea && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-area`} className="text-xs">
            {areaObrigatoria ? "Área que produz" : "Área que responde"}
          </Label>
          <Select value={area} onValueChange={setArea}>
            <SelectTrigger id={`${id}-area`} size="sm" aria-invalid={erroArea !== null}>
              <SelectValue placeholder={areaObrigatoria ? "Escolha a área" : "Qualquer área"} />
            </SelectTrigger>
            <SelectContent>
              {!areaObrigatoria && (
                <SelectItem value={QUALQUER_AREA}>Qualquer área (fila geral)</SelectItem>
              )}
              {AREAS.map((especialidade) => (
                <SelectItem key={especialidade} value={especialidade}>
                  {ESPECIALIDADE_LABEL[especialidade]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p
            className={
              erroArea ? "text-destructive text-[11px]" : "text-muted-foreground text-[11px]"
            }
          >
            {erroArea ??
              (areaObrigatoria
                ? "Só profissionais desta área publicam orientações nesta categoria."
                : "As conversas deste assunto vão para a fila desta área.")}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={fechar}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={criar.isPending}>
          {criar.isPending ? "Cadastrando…" : texto.salvar}
        </Button>
      </div>
    </form>
  );
}

export default NovoTermo;
