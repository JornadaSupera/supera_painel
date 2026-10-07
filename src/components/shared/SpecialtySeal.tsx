import {
  ESPECIALIDADE,
  ESPECIALIDADE_LABEL,
  SPECIALTY_FIELD_LABEL,
  type Especialidade,
} from "@/lib/enums";
import { cn } from "@/lib/utils";

/**
 * The seal of a care area: its field's name on the area's own colour.
 *
 * The colour sits on the tint and the dot, never on the text. Most of the brand
 * hues read under 4.5:1 as small text on a light background, and the name is
 * what carries the meaning anyway.
 */

const TONE: Record<Especialidade, { tint: string; dot: string }> = {
  medico_oncologista: { tint: "bg-primary/10 border-primary/25", dot: "bg-primary" },
  farmaceutico: { tint: "bg-supera-perfeicao/10 border-supera-perfeicao/25", dot: "bg-supera-perfeicao" },
  enfermeiro: { tint: "bg-supera-empatia/10 border-supera-empatia/25", dot: "bg-supera-empatia" },
  nutricionista: { tint: "bg-mood-1/10 border-mood-1/25", dot: "bg-mood-1" },
  psicologo: { tint: "bg-supera-uniao/10 border-supera-uniao/25", dot: "bg-supera-uniao" },
  dentista: { tint: "bg-supera-respeito/10 border-supera-respeito/25", dot: "bg-supera-respeito" },
  fisioterapeuta: { tint: "bg-supera-amor/10 border-supera-amor/25", dot: "bg-supera-amor" },
};

/** "Oncologia" is the whole clinic, so the doctor's seal names the person's area instead. */
function sealLabel(specialty: Especialidade): string {
  return specialty === ESPECIALIDADE.MEDICO
    ? ESPECIALIDADE_LABEL[specialty]
    : SPECIALTY_FIELD_LABEL[specialty];
}

export function SpecialtySeal({
  specialty,
  className,
}: {
  specialty: Especialidade;
  className?: string;
}) {
  const tone = TONE[specialty];

  return (
    <span
      className={cn(
        "text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
        tone.tint,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} />
      {sealLabel(specialty)}
    </span>
  );
}

export default SpecialtySeal;
