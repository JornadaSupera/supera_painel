import { z } from "zod";

import {
  CONSELHO_POR_ESPECIALIDADE,
  ESPECIALIDADE,
  PAPEL,
  type Especialidade,
} from "@/lib/enums";
import type { UsuarioEntrada } from "@/types/usuario";

/**
 * Validação da concessão de perfil.
 *
 * > [!] Cadastrar não é criar acesso.
 * A conta nasce quando a pessoa se cadastra; o painel concede o perfil sobre
 * ela. Por isso o formulário começa escolhendo uma conta, e não digitando nome
 * e e-mail: os dois são da conta, e quem os corrige é o titular. Ver
 * `UsuarioEntrada`.
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

/**
 * Os papéis que o cadastro sabe conceder.
 *
 * `gestor` fica de fora: ele descreve um alcance real na matriz de permissões,
 * e não existe como perfil no banco — há administrador e profissional, e nada
 * entre os dois. Oferecê-lo aqui produziria um cadastro que falha no envio.
 */
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
    account_id: z.string().min(1, "Selecione a conta que vai receber o perfil."),

    papel: z.enum(PAPEIS, { required_error: CAMPO_OBRIGATORIO }),

    especialidades: z.array(z.enum(ESPECIALIDADES)),

    /** `""` = sem principal declarada; a primeira da lista assume. */
    especialidade_principal: z.union([z.enum(ESPECIALIDADES), z.literal("")]),

    registro: z.string().max(30, "Registro muito longo."),
  })
  .superRefine((valores, contexto) => {
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
  account_id: "",
  papel: PAPEL.PROFISSIONAL,
  especialidades: [],
  especialidade_principal: "",
  registro: "",
};

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
