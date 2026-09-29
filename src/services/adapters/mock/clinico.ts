import { agendaClinica } from "@/mocks/agendaClinica";
import { ok, type ListResult } from "@/services/contracts";
import type { CompromissoAgenda } from "@/types/clinico";
import { simulate } from "./_helpers";

/**
 * Painel clínico — modo mock. Ver `mocks/agendaClinica.ts`.
 */

export async function getMinhaAgenda(params: {
  de: string;
  ate: string;
}): Promise<ListResult<CompromissoAgenda>> {
  return simulate(() => {
    const de = new Date(params.de).getTime();
    const ate = new Date(params.ate).getTime();

    const linhas = agendaClinica
      .filter((compromisso) => {
        const inicio = new Date(compromisso.inicio).getTime();
        return inicio >= de && inicio < ate;
      })
      .sort((a, b) => a.inicio.localeCompare(b.inicio));

    return ok(linhas);
  });
}
