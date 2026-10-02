import { z } from "zod";

import {
  CONSELHO_POR_ESPECIALIDADE,
  ESPECIALIDADE,
  PAPEL,
  type Especialidade,
} from "@/lib/enums";
import type { ConviteEquipeEntrada, UsuarioEntrada } from "@/types/usuario";

/**
 * Validação do cadastro de equipe: convidar pessoa nova ou conceder perfil.
 *
 * Os dois caminhos compartilham tudo o que é do PERFIL (papel, áreas, registro)
 * e diferem só em quem é a pessoa:
 *
 *  - `convite`: a conta ainda não existe. Digita-se nome e e-mail, a Edge
 *    Function cria a conta e manda o convite, e a pessoa define a própria senha.
 *  - `concessao`: a conta já existe (a pessoa já se cadastrou por outro lado).
 *    Escolhe-se a conta, e nome e e-mail não se corrigem aqui: são do titular.
 *    É também o modo da edição. Ver `UsuarioEntrada`.
 *
 * Duas regras dependem uma da outra e por isso ficam num `superRefine`, não em
 * campos isolados:
 *
 * 1. Papel `profissional` exige ao menos uma especialidade — sem nenhuma, o
 *    perfil é inerte: não alcança paciente e não registra nada.
 * 2. Com especialidade principal, o registro tem que ser o do conselho
 *    correspondente: um nutricionista não carrega CRM.
 */

const CAMPO_OBRIGATORIO = "Campo obrigatório.";

/** Como a pessoa entra na equipe. */
export const MODO_CADASTRO = {
  CONVITE: "convite",
  CONCESSAO: "concessao",
} as const;

export type ModoCadastro = (typeof MODO_CADASTRO)[keyof typeof MODO_CADASTRO];

const EMAIL = z.string().email();

/** Os papéis que o cadastro sabe conceder: administrador e profissional. */
const PAPEIS = [PAPEL.ADMIN, PAPEL.PROFISSIONAL] as const;

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
    modo: z.enum([MODO_CADASTRO.CONVITE, MODO_CADASTRO.CONCESSAO]),

    /** Só no modo `concessao`. */
    account_id: z.string(),

    /** Só no modo `convite`. */
    nome: z.string().max(120, "Nome muito longo."),
    email: z.string().max(254, "E-mail muito longo."),

    papel: z.enum(PAPEIS, { required_error: CAMPO_OBRIGATORIO }),

    especialidades: z.array(z.enum(ESPECIALIDADES)),

    /** `""` = sem principal declarada; a primeira da lista assume. */
    especialidade_principal: z.union([z.enum(ESPECIALIDADES), z.literal("")]),

    registro: z.string().max(30, "Registro muito longo."),
  })
  .superRefine((valores, contexto) => {
    if (valores.modo === MODO_CADASTRO.CONCESSAO && !valores.account_id) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["account_id"],
        message: "Selecione a conta que vai receber o perfil.",
      });
    }

    if (valores.modo === MODO_CADASTRO.CONVITE) {
      if (valores.nome.trim().length < 3) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nome"],
          message: "Informe o nome completo.",
        });
      }

      if (!EMAIL.safeParse(valores.email.trim()).success) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: "Informe um e-mail válido. O convite é enviado para ele.",
        });
      }
    }

    if (valores.papel !== PAPEL.PROFISSIONAL) return;

    if (valores.especialidades.length === 0) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["especialidades"],
        message: "Escolha ao menos uma área: sem nenhuma, o perfil não registra nada.",
      });
      return;
    }

    if (
      valores.especialidade_principal &&
      !valores.especialidades.includes(valores.especialidade_principal)
    ) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["especialidade_principal"],
        message: "A área principal precisa estar entre as escolhidas.",
      });
    }

    const principal = (valores.especialidade_principal ||
      valores.especialidades[0]) as Especialidade;
    const conselho = CONSELHO_POR_ESPECIALIDADE[principal];

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
        message: `A área principal usa registro no ${conselho}.`,
      });
    }
  });

export type UsuarioForm = z.infer<typeof usuarioSchema>;

export const VALORES_INICIAIS: UsuarioForm = {
  modo: MODO_CADASTRO.CONVITE,
  account_id: "",
  nome: "",
  email: "",
  papel: PAPEL.PROFISSIONAL,
  especialidades: [],
  especialidade_principal: "",
  registro: "",
};

/** O convite: pessoa nova, que ainda não tem conta. */
export function paraConvite(valores: UsuarioForm): ConviteEquipeEntrada {
  return {
    email: valores.email.trim().toLowerCase(),
    nome: valores.nome.trim(),
    papel: valores.papel,
    especialidades: [...valores.especialidades],
    especialidade_principal: valores.especialidade_principal || null,
    registro: valores.registro.trim() || null,
  };
}

/** Fronteira entre o que foi escolhido na tela e o que a coluna guarda. */
export function paraEntrada(valores: UsuarioForm): UsuarioEntrada {
  return {
    account_id: valores.account_id,
    papel: valores.papel,
    especialidades: [...valores.especialidades],
    especialidade_principal: valores.especialidade_principal || null,
    registro: valores.registro.trim() || null,
  };
}
