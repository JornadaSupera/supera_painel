import { formatDate } from "@/lib/format";
import type { DiagnosticoPaciente } from "@/types/paciente";

/**
 * The diagnoses beyond the main one, each with what was recorded about it — as
 * both readings of the record list them, the administrative one and the
 * clinical "Geral" tab.
 */
export function OtherDiagnosesList({ diagnoses }: { diagnoses: DiagnosticoPaciente[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {diagnoses.map((diagnosis) => (
        <li key={diagnosis.cid}>
          <span className="font-mono text-xs">{diagnosis.cid}</span> <span>{diagnosis.cid_descricao}</span>
          <p className="text-muted-foreground text-xs">
            {[
              diagnosis.estadiamento ? `estadiamento ${diagnosis.estadiamento}` : null,
              diagnosis.tnm,
              diagnosis.diagnostico_em ? `em ${formatDate(diagnosis.diagnostico_em)}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "sem detalhamento registrado"}
          </p>
        </li>
      ))}
    </ul>
  );
}
