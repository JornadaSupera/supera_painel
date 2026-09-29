import type { StatusConversa } from "@/lib/enums";
import { pacientes } from "./pacientes";

/**
 * Conversas e mensagens — modo mock. Ver `alertasClinicos.ts` para o porquê
 * de ser mutável.
 *
 * A base real TEM dado (4 conversas, 6 mensagens) — diferente da agenda e dos
 * alertas, o Chat mostra algo real assim que ligado ao Supabase. O mock existe
 * para desenvolver e testar os estados sem depender do banco.
 */

export interface ConversaClinicaMock {
  id: string;
  paciente_id: string;
  paciente_nome: string;
  assunto_label: string;
  status: StatusConversa;
  atribuida: boolean;
  ultima_mensagem_em: string;
  equipe_leu_em: string | null;
}

export interface MensagemClinicaMock {
  id: string;
  conversa_id: string;
  autor: "paciente" | "cuidador" | "profissional" | "sistema";
  corpo: string;
  criado_em: string;
}

function horasAtras(horas: number): string {
  const data = new Date();
  data.setHours(data.getHours() - horas);
  return data.toISOString();
}

const P = pacientes;

export const conversasClinicas: ConversaClinicaMock[] = [
  {
    id: "b14f0f8a-4e5f-405b-3b7d-5e6f70819203",
    paciente_id: P[0]?.id ?? "0",
    paciente_nome: P[0]?.nome ?? "Paciente",
    assunto_label: "Sintomas",
    status: "aberta",
    atribuida: false,
    ultima_mensagem_em: horasAtras(2),
    equipe_leu_em: null,
  },
  {
    id: "c25f1f9b-5f60-416c-4c8e-6f7081920314",
    paciente_id: P[2]?.id ?? "0",
    paciente_nome: P[2]?.nome ?? "Paciente",
    assunto_label: "Medicação",
    status: "aberta",
    atribuida: true,
    ultima_mensagem_em: horasAtras(20),
    equipe_leu_em: horasAtras(19),
  },
  {
    id: "d36f2f0c-6071-427d-5d9f-708192031425",
    paciente_id: P[3]?.id ?? "0",
    paciente_nome: P[3]?.nome ?? "Paciente",
    assunto_label: "Agendamento",
    status: "resolvida",
    atribuida: true,
    ultima_mensagem_em: horasAtras(96),
    equipe_leu_em: horasAtras(95),
  },
];

export const mensagensClinicas: MensagemClinicaMock[] = [
  {
    id: "e1", conversa_id: conversasClinicas[0]?.id ?? "",
    autor: "paciente", corpo: "Boa tarde, estou com náusea desde ontem à noite, depois da última sessão.",
    criado_em: horasAtras(3),
  },
  {
    id: "e2", conversa_id: conversasClinicas[0]?.id ?? "",
    autor: "sistema", corpo: "Conversa aberta a partir do assunto \"Sintomas\".",
    criado_em: horasAtras(3),
  },
  {
    id: "e3", conversa_id: conversasClinicas[0]?.id ?? "",
    autor: "paciente", corpo: "Já tentei tomar bastante água, mas continua incomodando bastante.",
    criado_em: horasAtras(2),
  },
  {
    id: "e4", conversa_id: conversasClinicas[1]?.id ?? "",
    autor: "paciente", corpo: "Posso tomar a medicação antes do café da manhã ou preciso comer primeiro?",
    criado_em: horasAtras(21),
  },
  {
    id: "e5", conversa_id: conversasClinicas[1]?.id ?? "",
    autor: "profissional", corpo: "Pode tomar em jejum, sem problema — só mantenha o mesmo horário todos os dias.",
    criado_em: horasAtras(20),
  },
  {
    id: "e6", conversa_id: conversasClinicas[2]?.id ?? "",
    autor: "paciente", corpo: "Consigo remarcar minha consulta de quinta para sexta?",
    criado_em: horasAtras(97),
  },
  {
    id: "e7", conversa_id: conversasClinicas[2]?.id ?? "",
    autor: "profissional", corpo: "Consegui remarcar para sexta às 14h. Até lá!",
    criado_em: horasAtras(96),
  },
];
