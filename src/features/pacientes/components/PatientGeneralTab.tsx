import { DetailCard, DetailRow, SectionHeading } from "@/components/shared";
import { FASE_TRATAMENTO_LABEL } from "@/lib/enums";
import { formatDate, formatLongDate } from "@/lib/format";
import type { PacienteDetalhe } from "@/types/paciente";
import { AppAccessDetails } from "./AppAccessDetails";
import { CampoSensivel } from "./CampoSensivel";
import { CuidadoresVinculados } from "./CuidadoresVinculados";
import { protocolDetails } from "../protocol";
import { OtherDiagnosesList } from "./DiagnosisDetails";
import { OrigemDosDados } from "./OrigemDosDados";

/**
 * "Geral" — the first tab of the record in tabs: the diagnosis and the
 * treatment beside the contacts, then the previous reactions. What the record
 * shows beyond the prototype (where the data came from, the app access) stays at
 * the end of the same tab instead of disappearing.
 *
 * The allergies are not repeated here: they live in the header, on every tab.
 * Both panels read this same tab, the administration included, so the
 * registration data it checks (code, birth date, sex) is here too.
 */
export function PatientGeneralTab({
  paciente,
  onUnlink,
  unlinking,
}: {
  paciente: PacienteDetalhe;
  onUnlink: () => void;
  unlinking: boolean;
}) {
  const otherDiagnoses = paciente.diagnosticos.filter((diagnosis) => !diagnosis.principal);

  return (
    <div className="flex flex-col gap-4">
      <OrigemDosDados paciente={paciente} />

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title="Diagnóstico & tratamento">
          <dl className="flex flex-col gap-3">
            <DetailRow label="Diagnóstico">
              {paciente.cid ? (
                <>
                  <span className="tabular-nums">{paciente.cid}</span>
                  {paciente.cid_descricao ? ` · ${paciente.cid_descricao}` : ""}
                </>
              ) : null}
            </DetailRow>

            {otherDiagnoses.length > 0 && (
              <DetailRow label="Outros diagnósticos">
                <OtherDiagnosesList diagnoses={otherDiagnoses} />
              </DetailRow>
            )}

            <DetailRow label="Estadiamento">
              {/* One expression per branch: two loose children would never be
                  nullish, and the empty field would lose its dash. */}
              {paciente.estadiamento || paciente.tnm ? (
                <>
                  {paciente.estadiamento ?? "—"}
                  {paciente.tnm && <p className="text-muted-foreground font-mono text-xs">{paciente.tnm}</p>}
                </>
              ) : null}
            </DetailRow>

            <DetailRow label="Diagnosticado em">
              {paciente.diagnostico_em && <span className="tabular-nums">{formatDate(paciente.diagnostico_em)}</span>}
            </DetailRow>

            <DetailRow label="Protocolo ativo">
              {paciente.protocolo && (
                <>
                  {paciente.protocolo.nome}
                  <p className="text-muted-foreground text-xs">{protocolDetails(paciente)}</p>
                </>
              )}
            </DetailRow>

            <DetailRow label="Início do protocolo">
              {paciente.plano_iniciado_em && formatLongDate(paciente.plano_iniciado_em)}
            </DetailRow>

            <DetailRow label="Fase do tratamento">
              {paciente.fase && FASE_TRATAMENTO_LABEL[paciente.fase]}
            </DetailRow>

            <DetailRow label="Médico responsável">{paciente.medico_responsavel_nome}</DetailRow>
          </dl>
        </DetailCard>

        <DetailCard title="Identificação & contato">
          <dl className="flex flex-col gap-3">
            <DetailRow label="Código">
              <span className="font-mono text-xs tabular-nums">{paciente.codigo}</span>
            </DetailRow>

            <DetailRow label="Nascimento">
              {paciente.nascimento && <span className="tabular-nums">{formatDate(paciente.nascimento)}</span>}
            </DetailRow>

            <DetailRow label="Sexo">
              {paciente.sexo && <span className="capitalize">{paciente.sexo}</span>}
            </DetailRow>

            <DetailRow label="Telefone">
              <CampoSensivel
                pacienteId={paciente.id}
                campo="telefone"
                mascarado={paciente.telefone_mascarado}
                nomePaciente={paciente.nome}
              />
            </DetailRow>

            <DetailRow label="E-mail">
              <CampoSensivel
                pacienteId={paciente.id}
                campo="email"
                mascarado={paciente.email_mascarado}
                nomePaciente={paciente.nome}
              />
            </DetailRow>
          </dl>

          <div className="flex flex-col gap-1">
            <SectionHeading className="text-[11px]">Cuidador</SectionHeading>
            <CuidadoresVinculados pacienteId={paciente.id} />
          </div>
        </DetailCard>
      </div>

      <DetailCard title="Reações prévias">
        {paciente.reacoes_previas.length > 0 ? (
          <ul className="flex flex-col gap-1 text-sm">
            {paciente.reacoes_previas.map((reaction) => (
              <li key={reaction}>· {reaction}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">Nenhuma registrada</p>
        )}
      </DetailCard>

      {paciente.observacoes && (
        <DetailCard title="Observações">
          <p className="text-sm leading-relaxed">{paciente.observacoes}</p>
        </DetailCard>
      )}

      <DetailCard title="Acesso ao aplicativo">
        <AppAccessDetails paciente={paciente} onUnlink={onUnlink} unlinking={unlinking} />
      </DetailCard>
    </div>
  );
}

export default PatientGeneralTab;
