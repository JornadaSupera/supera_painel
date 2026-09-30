import type { CompromissoAgenda } from "@/types/clinico";
import { pacientes } from "./pacientes";

/**
 * Agenda pessoal do profissional — modo mock.
 *
 * Datas relativas a "agora", não fixas: um mock com data fixa envelhece e some
 * da janela "esta semana" assim que o calendário vira a página. Os pacientes
 * são os primeiros da base — os mesmos 25 do protótipo — para que abrir a
 * ficha a partir de um compromisso leve a algo que existe.
 */

function horario(diasAPartirDeHoje: number, hora: number, minuto = 0): Date {
  const data = new Date();
  data.setHours(hora, minuto, 0, 0);
  data.setDate(data.getDate() + diasAPartirDeHoje);
  return data;
}

function iso(data: Date): string {
  return data.toISOString();
}

const SEM_PACIENTE = { id: "0", nome: "Paciente" };

/** `noUncheckedIndexedAccess` exige o fallback — a base tem 81 linhas, então nunca é usado de fato. */
function paciente(indice: number): { id: string; nome: string } {
  const encontrado = pacientes[indice];
  return encontrado ? { id: encontrado.id, nome: encontrado.nome } : SEM_PACIENTE;
}

export const agendaClinica: CompromissoAgenda[] = [
  {
    id: "3f6b2b0e-6a3a-4b8b-9a1a-0f1b2c3d4e5f",
    paciente_id: paciente(0).id,
    paciente_nome: paciente(0).nome,
    tipo_label: "Consulta médica",
    status_label: "Agendado",
    status_codigo: "scheduled",
    status_tom: "info",
    inicio: iso(horario(0, 9, 0)),
    fim: iso(horario(0, 9, 30)),
    local: "Consultório 2",
    confirmado_em: null,
  },
  {
    id: "4a7c3c1f-7b4b-4c9c-8b2b-1a2c3d4e5f60",
    paciente_id: paciente(1).id,
    paciente_nome: paciente(1).nome,
    tipo_label: "Sessão de quimioterapia",
    status_label: "Confirmado",
    status_codigo: "scheduled",
    status_tom: "success",
    inicio: iso(horario(0, 10, 30)),
    fim: iso(horario(0, 12, 30)),
    local: "Sala de Infusão 1",
    confirmado_em: iso(horario(-1, 14, 0)),
  },
  {
    id: "5b8d4d2a-8c5c-4dad-9c3c-2b3d4e5f6071",
    paciente_id: paciente(2).id,
    paciente_nome: paciente(2).nome,
    tipo_label: "Retorno",
    status_label: "Agendado",
    status_codigo: "scheduled",
    status_tom: "info",
    inicio: iso(horario(1, 14, 0)),
    fim: iso(horario(1, 14, 30)),
    local: "Consultório 2",
    confirmado_em: null,
  },
  {
    id: "6c9e5e3b-9d6d-4ebe-ad4d-3c4e5f607182",
    paciente_id: paciente(3).id,
    paciente_nome: paciente(3).nome,
    tipo_label: "Consulta médica",
    status_label: "Falta",
    status_codigo: "no_show",
    status_tom: "warning",
    inicio: iso(horario(-1, 9, 0)),
    fim: iso(horario(-1, 9, 30)),
    local: "Consultório 2",
    confirmado_em: null,
  },
];
