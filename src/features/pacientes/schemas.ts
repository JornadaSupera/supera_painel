import { z } from "zod";

import { digitsOnly } from "@/lib/mask";
import { isValidCpf, isValidBirthDate, isValidPhone } from "@/lib/validation";
import type { PacienteEntrada } from "@/types/paciente";

/**
 * Validação do cadastro e da edição de paciente.
 *
 * O formulário é dividido em três etapas e cada uma valida os próprios campos —
 * a lista está em `ETAPAS`, então rótulo do passo e campos do passo não ficam
 * em arquivos diferentes.
 *
 * > [!] O formulário coleta o que o backend sabe gravar, e nada além.
 * Campo que não tem coluna do outro lado não aparece aqui: quem preenche na
 * recepção não tem como saber que aquele valor se perde no envio, e um cadastro
 * que parece completo e chega pela metade é pior do que um cadastro curto.
 * Ver `PacienteEntrada` para a lista do que ficou de fora e por quê.
 *
 * > [!] Sem `transform` no schema, de propósito.
 * O valor validado tem exatamente a forma do valor digitado, o que mantém o
 * tipo do `useForm` simples e previsível. A normalização — dígitos do CPF,
 * e-mail em minúsculas, campo vazio virando `null` — acontece uma vez só, em
 * `paraEntrada()`, na fronteira com a camada de dados.
 */

const CAMPO_OBRIGATORIO = "Campo obrigatório.";

export const pacienteSchema = z.object({
  /* ------------------------------------------------------- identificação */
  nome: z.string().min(3, "Informe o nome completo.").max(120, "Nome muito longo."),

  cpf: z.string().min(1, CAMPO_OBRIGATORIO).refine(isValidCpf, "CPF inválido — confira os dígitos."),

  nascimento: z
    .string()
    .min(1, CAMPO_OBRIGATORIO)
    .refine(isValidBirthDate, "Data de nascimento inválida."),

  /* ---------------------------------------------------- histórico clínico */
  alergias: z.array(z.string()),
  reacoes_previas: z.array(z.string()),

  /* ------------------------------------------------------------- contato */
  telefone: z
    .string()
    .min(1, CAMPO_OBRIGATORIO)
    .refine(isValidPhone, "Telefone inválido — informe DDD e número."),

  email: z.string().min(1, CAMPO_OBRIGATORIO).email("E-mail inválido."),

  convenio: z.string().max(80, "Nome do convênio muito longo."),

  /** Emite o convite de acesso ao app logo após salvar. */
  enviar_convite: z.boolean(),
});

export type PacienteForm = z.infer<typeof pacienteSchema>;

/**
 * Mesmo formulário, na edição.
 *
 * CPF, telefone e e-mail chegam à tela MASCARADOS — é assim que a camada de
 * dados os entrega. Validá-los como se fossem o valor real reprovaria uma
 * máscara perfeitamente correta, e enviá-los de volta sobrescreveria o dado da
 * pessoa por uma fileira de pontos.
 *
 * Então: CPF não é editável, e contato começa vazio com o valor atual no
 * placeholder. Vazio significa "manter o que está lá"; preenchido é validado
 * normalmente.
 */
export const pacienteEdicaoSchema = pacienteSchema.extend({
  cpf: z.string(),
  telefone: z.string().refine((valor) => !valor || isValidPhone(valor), "Telefone inválido."),
  email: z
    .string()
    .refine((valor) => !valor || z.string().email().safeParse(valor).success, "E-mail inválido."),
});

/** Formulário em branco. Convite marcado: é o padrão anunciado no cabeçalho. */
export const VALORES_INICIAIS: PacienteForm = {
  nome: "",
  cpf: "",
  nascimento: "",
  alergias: [],
  reacoes_previas: [],
  telefone: "",
  email: "",
  convenio: "",
  enviar_convite: true,
};

/**
 * Única fronteira entre o que foi digitado e o que a coluna guarda.
 *
 * CPF e telefone viram dígitos, e-mail vira minúsculas, campo opcional vazio
 * vira `null` — não `""`. A diferença importa: `null` no Postgres significa
 * "não informado", e `""` significa "informado como vazio".
 */
export function paraEntrada(valores: PacienteForm): PacienteEntrada {
  const vazioComoNulo = (valor: string) => (valor.trim() ? valor.trim() : null);

  return {
    nome: valores.nome.trim().replace(/\s+/g, " "),
    cpf: digitsOnly(valores.cpf),
    nascimento: valores.nascimento,
    telefone: digitsOnly(valores.telefone),
    email: valores.email.trim().toLowerCase(),
    convenio: vazioComoNulo(valores.convenio),
    alergias: valores.alergias,
    reacoes_previas: valores.reacoes_previas,
    enviar_convite: valores.enviar_convite,
  };
}

/**
 * As etapas, na ordem em que aparecem, com os campos que cada uma valida.
 *
 * A tela percorre esta lista — assim ninguém precisa manter o rótulo do passo
 * num lugar e a lista de campos em outro.
 */
export const ETAPAS = [
  {
    id: "identificacao",
    titulo: "Identificação",
    descricao: "Quem é a pessoa. O CPF é a chave do cadastro e não muda depois.",
    campos: ["nome", "cpf", "nascimento"],
  },
  {
    id: "historico",
    titulo: "Histórico clínico",
    descricao: "Alergias e reações já apresentadas — o que a equipe precisa ver antes de prescrever.",
    campos: ["alergias", "reacoes_previas"],
  },
  {
    id: "contato",
    titulo: "Contato e acesso",
    descricao: "Para onde vai o convite do aplicativo.",
    campos: ["telefone", "email", "convenio", "enviar_convite"],
  },
] as const satisfies readonly {
  id: string;
  titulo: string;
  descricao: string;
  campos: readonly (keyof PacienteForm)[];
}[];
