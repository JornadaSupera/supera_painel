import type { CompromissoAgenda } from "@/types/clinico";

/**
 * O resumo do período que a agenda mostra: só contagem do que a leitura da
 * agenda já traz.
 *
 * Fica de fora a OCUPAÇÃO: ela pede a capacidade instalada, e a que existe
 * (Configurações → Metas) é dos atendimentos da clínica toda, não da agenda de
 * uma pessoa. Uma taxa sobre o denominador errado parece medição e não é.
 */
export interface ResumoDaAgenda {
  total: number;
  realizados: number;
  faltas: number;
  reagendados: number;
  cancelados: number;
}

export function resumoDoPeriodo(compromissos: CompromissoAgenda[]): ResumoDaAgenda {
  const contar = (codigo: string) =>
    compromissos.filter((compromisso) => compromisso.status_codigo === codigo).length;

  return {
    total: compromissos.length,
    realizados: contar("completed"),
    faltas: contar("no_show"),
    reagendados: contar("rescheduled"),
    cancelados: contar("cancelled"),
  };
}
