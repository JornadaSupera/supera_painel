import { formatDateTime } from "@/lib/format";
import type { CompromissoAgenda } from "@/types/clinico";

/**
 * A confirmação de comparecimento feita pelo paciente (ou por quem o acompanha)
 * no aplicativo.
 *
 * Só vale para o compromisso ainda agendado: o banco apaga a confirmação quando
 * ele sai desse estado, e um cancelado ou remarcado "confirmado" na tela seria
 * mentira. A mesma regra aqui impede que um dado atrasado a contradiga.
 */
export function isConfirmed(appointment: Pick<CompromissoAgenda, "status_codigo" | "confirmado_em">): boolean {
  return appointment.status_codigo === "scheduled" && appointment.confirmado_em !== null;
}

/** "Confirmada pelo aplicativo em 05/10/2026 14:32". */
export function confirmationText(appointment: Pick<CompromissoAgenda, "confirmado_em">): string {
  return appointment.confirmado_em
    ? `Confirmada pelo aplicativo em ${formatDateTime(appointment.confirmado_em)}`
    : "Ainda não confirmada pelo aplicativo";
}
