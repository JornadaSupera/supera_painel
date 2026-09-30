import type { SatisfactionMilestone } from "@/types/satisfaction";
import { pacientes } from "./pacientes";

/**
 * Pesquisa de satisfação (NPS) — modo mock.
 *
 * Datas relativas a hoje, para as respostas caírem sempre nas janelas de 30, 90
 * e 180 dias. Os pacientes são os primeiros da base, os mesmos que a agenda e as
 * filas apontam.
 */

export const marcosNps: SatisfactionMilestone[] = [
  { code: "primeiro_acesso", label: "Primeiro acesso ao app" },
  { code: "metade_tratamento", label: "Metade do tratamento" },
  { code: "ultimo_ciclo", label: "Após o último ciclo" },
];

export interface PesquisaMock {
  id: string;
  paciente_id: string;
  marco: string;
  aberta_em: string;
  resposta: { nota: number; comentario: string | null; respondida_em: string } | null;
}

function diasAtras(dias: number, hora = 10): string {
  const data = new Date();
  data.setHours(hora, 0, 0, 0);
  data.setDate(data.getDate() - dias);
  return data.toISOString();
}

const COMENTARIOS: Record<number, string> = {
  10: "Atendimento excelente, a equipe me deu muita segurança durante o tratamento.",
  9: "O aplicativo ajuda muito a acompanhar as consultas e tirar dúvidas rápido.",
  8: "Bom, mas as vezes demoram a responder no chat.",
  7: "Gostei do aplicativo, só achei o diário um pouco longo de preencher.",
  6: "Esperei mais de uma hora no dia da infusão e ninguém avisou do atraso.",
  4: "Difícil de achar minhas orientações dentro do aplicativo.",
  2: "Mandei mensagem no chat e ficou dois dias sem resposta.",
};

/** [dias desde a abertura, marco, nota, tem comentário, dias até responder] — `null` nota = sem resposta. */
const SEMENTE: [number, string, number | null, boolean, number][] = [
  [172, "primeiro_acesso", 10, true, 1],
  [160, "primeiro_acesso", 9, false, 2],
  [150, "primeiro_acesso", 6, true, 1],
  [141, "primeiro_acesso", 8, false, 3],
  [130, "metade_tratamento", 10, true, 2],
  [118, "primeiro_acesso", null, false, 0],
  [104, "primeiro_acesso", 9, true, 1],
  [96, "metade_tratamento", 7, true, 4],
  [88, "primeiro_acesso", 10, false, 1],
  [81, "primeiro_acesso", 4, true, 2],
  [75, "ultimo_ciclo", 9, false, 3],
  [66, "primeiro_acesso", 8, true, 1],
  [58, "primeiro_acesso", null, false, 0],
  [52, "metade_tratamento", 10, true, 2],
  [47, "primeiro_acesso", 9, false, 1],
  [40, "primeiro_acesso", 2, true, 1],
  [35, "ultimo_ciclo", 10, true, 2],
  [29, "primeiro_acesso", 7, false, 1],
  [24, "primeiro_acesso", 10, false, 1],
  [19, "metade_tratamento", 9, true, 3],
  [14, "primeiro_acesso", 6, false, 2],
  [11, "primeiro_acesso", null, false, 0],
  [8, "primeiro_acesso", 10, true, 1],
  [5, "ultimo_ciclo", 8, false, 2],
  [3, "primeiro_acesso", 9, false, 1],
  [1, "primeiro_acesso", null, false, 0],
];

export const pesquisasNps: PesquisaMock[] = SEMENTE.map(([aberta, marco, nota, comenta, demora], indice) => ({
  id: `mock-nps-${indice + 1}`,
  paciente_id: pacientes[indice % Math.max(1, pacientes.length)]?.id ?? "0",
  marco,
  aberta_em: diasAtras(aberta),
  resposta:
    nota === null
      ? null
      : {
          nota,
          comentario: comenta ? (COMENTARIOS[nota] ?? "Sem mais comentários, obrigado.") : null,
          respondida_em: diasAtras(Math.max(0, aberta - demora), 15),
        },
}));
