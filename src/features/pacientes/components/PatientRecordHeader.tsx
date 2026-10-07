import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { StatusBadge, TONE_RISK, UserAvatar } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { RISCO_LABEL } from "@/lib/enums";
import { ageInYears } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PacienteDetalhe } from "@/types/paciente";
import { CampoSensivel } from "./CampoSensivel";

/**
 * The top of the record, the same on every tab: who the patient is, what they
 * are being treated for, and what nobody may forget — the allergies.
 *
 * The allergy line is never left out. An empty list says "nenhuma registrada"
 * in a neutral box, because a missing banner would read the same as an unknown.
 */

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "primary" | "neutral" }) {
  return (
    <li>
      <StatusBadge tone={tone} size="sm" pill className={cn(tone === "neutral" && "bg-card")}>
        {children}
      </StatusBadge>
    </li>
  );
}

function Allergies({ allergies }: { allergies: string[] }) {
  if (allergies.length === 0) {
    return (
      <p className="bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-xs">
        <span className="font-semibold">Alergias:</span> nenhuma registrada
      </p>
    );
  }

  return (
    <p
      role="note"
      className="border-destructive/40 bg-destructive/5 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
    >
      <CircleAlert size={16} aria-hidden="true" className="text-destructive shrink-0" />
      <span>
        <span className="font-semibold">Alergias:</span> {allergies.join(", ")}
      </span>
    </p>
  );
}

export function PatientRecordHeader({
  paciente,
  actions,
}: {
  paciente: PacienteDetalhe;
  actions?: ReactNode;
}) {
  const age = ageInYears(paciente.nascimento);

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <UserAvatar name={paciente.nome} size="xl" className="ring-primary/25 ring-2 ring-offset-2" />

            <div className="flex min-w-0 flex-col gap-1">
              <h1 className="truncate text-xl font-semibold tracking-tight">{paciente.nome}</h1>

              <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
                {age !== null && (
                  <>
                    <span className="tabular-nums">{age} anos</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>CPF</span>
                <CampoSensivel
                  pacienteId={paciente.id}
                  campo="cpf"
                  mascarado={paciente.cpf_mascarado}
                  nomePaciente={paciente.nome}
                />
              </p>

              <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Resumo clínico">
                {paciente.protocolo && <Chip tone="primary">{paciente.protocolo.nome}</Chip>}
                {paciente.cid && (
                  <Chip>
                    {paciente.cid}
                    {paciente.cid_descricao ? ` · ${paciente.cid_descricao}` : ""}
                  </Chip>
                )}
                {paciente.estadiamento && <Chip>Estadiamento {paciente.estadiamento}</Chip>}
                {paciente.risco && (
                  <li>
                    <StatusBadge tone={TONE_RISK[paciente.risco]} size="sm" pill>
                      Risco {RISCO_LABEL[paciente.risco].toLowerCase()}
                    </StatusBadge>
                  </li>
                )}
              </ul>
            </div>
          </div>

          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>

        <Allergies allergies={paciente.alergias} />
      </CardContent>
    </Card>
  );
}

export default PatientRecordHeader;
