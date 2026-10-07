import { ChevronDown, Quote } from "lucide-react";
import { useState } from "react";

import { SkeletonRows } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { FASE_TRATAMENTO_LABEL } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AlertaClinico } from "@/types/clinico";
import { SEVERITY_DOT } from "../alert-tones";
import { usePacientesPorId } from "../hooks/useMeusPacientes";
import { useDiarySymptoms, usePatientDiary } from "../hooks/usePatientRecord";

/**
 * What the team needs to decide who takes an alert: the patient's treatment,
 * the group the symptom belongs to and, on demand, the diary entry that raised
 * it — what the patient wrote and every symptom marked that day.
 *
 * Facts only. The panel does not suggest an area or a conduct: whoever reads it
 * decides. The diary is read on demand because each read goes to the audit trail.
 */
export function AlertContext({
  alerta,
  defaultOpen = false,
}: {
  alerta: AlertaClinico;
  defaultOpen?: boolean;
}) {
  const [aberto, setAberto] = useState(defaultOpen);
  const pacientes = usePacientesPorId(true);
  const paciente = pacientes.porId.get(alerta.paciente_id);

  const tratamento = [
    paciente?.protocolo_nome && paciente.protocolo_nome !== "—" ? paciente.protocolo_nome : null,
    paciente?.cid ? [paciente.cid, paciente.cid_descricao].filter(Boolean).join(" · ") : null,
    paciente?.fase ? FASE_TRATAMENTO_LABEL[paciente.fase] : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-2">
      <dl className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <div className="flex gap-1">
          <dt>Sintoma:</dt>
          <dd className="text-foreground">
            {alerta.sintoma_psicologico ? "grupo psicológico" : "grupo físico"}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Tratamento:</dt>
          <dd className="text-foreground">
            {tratamento.length > 0 ? tratamento.join(" · ") : "sem protocolo registrado"}
          </dd>
        </div>
      </dl>

      {alerta.diario_id && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={aberto}
          className="text-primary-ink -ml-2 h-7 w-fit gap-1 px-2 text-xs"
          onClick={() => setAberto((atual) => !atual)}
        >
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={cn("transition-transform", aberto && "rotate-180")}
          />
          {aberto ? "Ocultar o registro do diário" : "Ver o que o paciente registrou"}
        </Button>
      )}

      {aberto && alerta.diario_id && (
        <RegistroDoDiario alerta={alerta} diarioId={alerta.diario_id} />
      )}
    </div>
  );
}

function RegistroDoDiario({ alerta, diarioId }: { alerta: AlertaClinico; diarioId: string }) {
  const diario = usePatientDiary(alerta.paciente_id);
  const registro = diario.data?.entries.find((entrada) => entrada.id === diarioId);
  const sintomas = useDiarySymptoms(diarioId, Boolean(registro));

  if (diario.isLoading) return <SkeletonRows count={2} />;

  if (diario.isError || !registro) {
    return (
      <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-xs">
        {diario.isError
          ? "Não foi possível ler o diário agora."
          : "O registro do diário que gerou este alerta não está disponível."}
      </p>
    );
  }

  return (
    <div className="bg-muted/40 flex flex-col gap-2.5 rounded-xl border p-3">
      <p className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
        Diário de {formatDate(registro.entry_date)} ·{" "}
        {registro.by_caregiver ? "pelo acompanhante" : "pelo paciente"}
      </p>

      {registro.free_text ? (
        <blockquote className="flex gap-2 text-sm leading-relaxed">
          <Quote size={14} aria-hidden="true" className="text-muted-foreground mt-1 shrink-0" />
          <span className="whitespace-pre-line">{registro.free_text}</span>
        </blockquote>
      ) : (
        <p className="text-muted-foreground text-xs">Sem texto livre neste registro.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-xs">Sintomas marcados no mesmo dia</p>
        {sintomas.isLoading ? (
          <SkeletonRows count={1} />
        ) : sintomas.isError ? (
          <p className="text-muted-foreground text-xs">Não foi possível ler os sintomas.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {(sintomas.data ?? []).map((sintoma) => (
              <li
                key={sintoma.id}
                className={cn(
                  "bg-card flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
                  sintoma.symptom_label === alerta.sintoma_label &&
                    "border-foreground/30 font-semibold",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 rounded-full", SEVERITY_DOT[sintoma.severity])}
                />
                {sintoma.symptom_label} · grau {sintoma.grade}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AlertContext;
