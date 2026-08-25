import { z } from "zod";

import {
  CONSELHO_POR_ESPECIALIDADE,
  ESPECIALIDADE,
  PAPEL,
  type Especialidade,
} from "@/lib/enums";
import type { UsuarioEntrada } from "@/types/usuario";

/**
 * Validação do cadastro de profissional.
 *
 * Duas regras dependem umas das outras e por isso ficam num `superRefine`, não
 * em campos isolados:
 *
 * 1. Papel `profissional` exige especialidade — sem ela a pessoa não pertence a
 *    nenhum dos sete espaços de trabalho e o RBAC não tem o que resolver.
 * 2. Com especialidade, o registro tem que ser o do conselho correspondente:
 *    um nutricionista não carrega CRM.
 *
 * A janela de atendimento também é validada em par: fim depois do início.
 */

const CAMPO_OBRIGATORIO = "Campo obrigatório.";
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

const PAPEIS = [PAPEL.ADMIN, PAPEL.GESTOR, PAPEL.PROFISSIONAL] as const;

const ESPECIALIDADES = [
  ESPECIALIDADE.MEDICO,
  ESPECIALIDADE.FARMACEUTICO,
  ESPECIALIDADE.ENFERMEIRO,
  ESPECIALIDADE.NUTRICIONISTA,
  ESPECIALIDADE.PSICOLOGO,
  ESPECIALIDADE.DENTISTA,
  ESPECIALIDADE.FISIOTERAPEUTA,
] as const;

export const usuarioSchema = z
  .object({
    nome: z.string().min(3, "Informe o nome completo.").max(120, "Nome muito longo."),
    tratamento: z.string().max(10, "Use a forma curta, como Dra. ou Enf."),

    email: z
      .string()
      .min(1, CAMPO_OBRIGATORIO)
      .email("E-mail inválido.")
      .refine(
        (valor) => valor.trim().toLowerCase().endsWith("@cosc.com.br"),
        "Use o e-mail corporativo (@cosc.com.br).",
      ),

    papel: z.enum(PAPEIS, { required_error: CAMPO_OBRIGATORIO }),

    /** `""` = sem especialidade, que é o caso de administrador e gestor. */
    especialidade: z.union([z.enum(ESPECIALIDADES), z.literal("")]),

    registro: z.string().max(30, "Registro muito longo."),

    horario_inicio: z.string().regex(HORA, "Use o formato HH:MM."),
    horario_fim: z.string().regex(HORA, "Use o formato HH:MM."),

    mfa_ativo: z.boolean(),
  })
  .superRefine((valores, contexto) => {
    if (valores.papel === PAPEL.PROFISSIONAL && !valores.especialidade) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["especialidade"],
        message: "Profissional clínico precisa de uma especialidade.",
      });
    }

    if (valores.especialidade) {
      const conselho = CONSELHO_POR_ESPECIALIDADE[valores.especialidade as Especialidade];

      if (!valores.registro.trim()) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["registro"],
          message: `Informe o registro no ${conselho}.`,
        });
      } else if (!valores.registro.toUpperCase().includes(conselho)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["registro"],
          message: `Esta especialidade usa registro no ${conselho}.`,
        });
      }
    }

    if (valores.horario_inicio >= valores.horario_fim) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["horario_fim"],
        message: "O fim do atendimento precisa ser depois do início.",
      });
    }
  });

export type UsuarioForm = z.infer<typeof usuarioSchema>;

/** Padrões do protótipo: janela 08:00–18:00 e segundo fator ligado. */
export const VALORES_INICIAIS: UsuarioForm = {
  nome: "",
  tratamento: "",
  email: "",
  papel: PAPEL.PROFISSIONAL,
  especialidade: "",
  registro: "",
  horario_inicio: "08:00",
  horario_fim: "18:00",
  mfa_ativo: true,
};

/** Fronteira entre o que foi digitado e o que a coluna guarda. */
export function paraEntrada(valores: UsuarioForm): UsuarioEntrada {
  return {
    nome: valores.nome.trim().replace(/\s+/g, " "),
    tratamento: valores.tratamento.trim() || null,
    email: valores.email.trim().toLowerCase(),
    papel: valores.papel,
    especialidade: valores.especialidade || null,
    registro: valores.registro.trim() || null,
    horario_inicio: valores.horario_inicio,
    horario_fim: valores.horario_fim,
    mfa_ativo: valores.mfa_ativo,
  };
}
