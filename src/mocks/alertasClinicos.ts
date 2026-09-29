import type { CondutaAlerta, StatusAlerta } from "@/lib/enums";
import { pacientes } from "./pacientes";

/**
 * Fila de alertas — modo mock.
 *
 * Mutável de propósito: `assumir`/`resolver` no adapter mock mudam estes
 * objetos em memória, para que a tela reaja sem precisar de um backend.
 * A base real está com ZERO alertas hoje (nenhum gatilho de criticidade
 * cadastrado, ver PA-04) — o mock é o único lugar em que a fila tem conteúdo
 * para conferir o desenho da tela.
 */

export interface AlertaClinicoMock {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  sintoma_label: string;
  grau: number;
  status: StatusAlerta;
  conduta_tipo: CondutaAlerta | null;
  conduta_notas: string | null;
  criado_em: string;
  assumido_em: string | null;
  resolvido_em: string | null;
}

function horasAtras(horas: number): string {
  const data = new Date();
  data.setHours(data.getHours() - horas);
  return data.toISOString();
}

const P = pacientes;

export const alertasClinicos: AlertaClinicoMock[] = [
  {
    id: "7d0f6f4c-0a1b-4c2d-9e3f-1a2b3c4d5e6f",
    paciente_id: P[4]?.id ?? "0",
    paciente_nome: P[4]?.nome ?? "Paciente",
    sintoma_label: "Febre",
    grau: 5,
    status: "pendente",
    conduta_tipo: null,
    conduta_notas: null,
    criado_em: horasAtras(1),
    assumido_em: null,
    resolvido_em: null,
  },
  {
    id: "8e1f7f5d-1b2c-4d3e-0f4a-2b3c4d5e6f70",
    paciente_id: P[5]?.id ?? "0",
    paciente_nome: P[5]?.nome ?? "Paciente",
    sintoma_label: "Sangramento",
    grau: 4,
    status: "pendente",
    conduta_tipo: null,
    conduta_notas: null,
    criado_em: horasAtras(3),
    assumido_em: null,
    resolvido_em: null,
  },
  {
    id: "9f2f8f6e-2c3d-4e4f-1f5b-3c4d5e6f7081",
    paciente_id: P[0]?.id ?? "0",
    paciente_nome: P[0]?.nome ?? "Paciente",
    sintoma_label: "Dor abdominal",
    grau: 4,
    status: "assumido",
    conduta_tipo: null,
    conduta_notas: null,
    criado_em: horasAtras(6),
    assumido_em: horasAtras(5),
    resolvido_em: null,
  },
  {
    id: "a03f9f7f-3d4e-4f5a-2a6c-4d5e6f708192",
    paciente_id: P[1]?.id ?? "0",
    paciente_nome: P[1]?.nome ?? "Paciente",
    sintoma_label: "Vômito",
    grau: 3,
    status: "resolvido",
    conduta_tipo: "orientacao",
    conduta_notas: "Orientação de hidratação e antiemético de resgate. Sem sinais de alarme ao contato.",
    criado_em: horasAtras(30),
    assumido_em: horasAtras(29),
    resolvido_em: horasAtras(28),
  },
];
