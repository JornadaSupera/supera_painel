import { formatDate } from "@/lib/format";
import type { PacienteDetalhe } from "@/types/paciente";

/**
 * How the record words the treatment. Both readings of it — the administrative
 * one and the clinical "Geral" tab — use this one copy, so the two never describe
 * the same protocol in different words.
 */

/** The line under the protocol name: "FOLFOX · 12 ciclos previstos · curativa · início em 04/04/2026". */
export function protocolDetails(paciente: PacienteDetalhe): string {
  if (!paciente.protocolo) return "";
  return (
    [
      paciente.protocolo.medicamentos.join(" · ") || null,
      paciente.protocolo.ciclos ? `${paciente.protocolo.ciclos} ciclos previstos` : null,
      paciente.intencao_terapeutica,
      paciente.plano_iniciado_em ? `início em ${formatDate(paciente.plano_iniciado_em)}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "sem detalhamento registrado"
  );
}
