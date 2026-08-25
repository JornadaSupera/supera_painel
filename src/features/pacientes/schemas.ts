import { z } from "zod";

import { FASE_TRATAMENTO, RISCO } from "@/lib/enums";
import { somenteDigitos } from "@/lib/mask";
import { cpfValido, nascimentoValido, telefoneValido } from "@/lib/validacao";
import type { PacienteEntrada } from "@/types/paciente";

/**
 * Validação do cadastro e da edição de paciente.
 *
 * O formulário é dividido em três etapas e cada uma valida os próprios campos —
 * a lista está em `ETAPAS`, então rótulo do passo e campos do passo não ficam
 * em arquivos diferentes.
 *
 * > [!] Sem `transform` no schema, de propósito.
 * O valor validado tem exatamente a forma do valor digitado, o que mantém o
 * tipo do `useForm` simples e previsível. A normalização — dígitos do CPF,
 * e-mail em minúsculas, campo vazio virando `null` — acontece uma vez só, em
 * `paraEntrada()`, na fronteira com a camada de dados.
 */

const CAMPO_OBRIGATORIO = "Campo obrigatório.";

const FASES = [
  FASE_TRATAMENTO.ATIVO,
  FASE_TRATAMENTO.SEGUIMENTO,
  FASE_TRATAMENTO.MANUTENCAO,
  FASE_TRATAMENTO.REMISSAO,
  FASE_TRATAMENTO.FINALIZACAO,
] as const;

const RISCOS = [RISCO.BAIXO, RISCO.MEDIO, RISCO.ALTO] as const;

export const pacienteSchema = z.object({
  /* ------------------------------------------------------- identificação */
  nome: z.string().min(3, "Informe o nome completo.").max(120, "Nome muito longo."),

  cpf: z.string().min(1, CAMPO_OBRIGATORIO).refine(cpfValido, "CPF inválido — confira os dígitos."),

  nascimento: z
    .string()
    .min(1, CAMPO_OBRIGATORIO)
    .refine(nascimentoValido, "Data de nascimento inválida."),

  sexo: z.enum(["feminino", "masculino"], { required_error: CAMPO_OBRIGATORIO }),

  /* --------------------------------------------------------- diagnóstico */
  cid: z.string().min(1, "Selecione o CID-10."),
  protocolo_id: z.string().min(1, "Selecione o protocolo terapêutico."),
  fase: z.enum(FASES, { required_error: CAMPO_OBRIGATORIO }),

  /**
   * Classificação de risco feita pela equipe assistencial e registrada no
   * cadastro. O painel não calcula risco: inferência clínica no front-end está
   * fora do escopo contratado.
   */
  risco: z.enum(RISCOS, { required_error: CAMPO_OBRIGATORIO }),

  estadiamento: z.string().max(12, "Use a notação curta, como IIIA."),
  diagnostico_em: z.string(),
  medico_responsavel_id: z.string(),
  alergias: z.array(z.string()),
  reacoes_previas: z.array(z.string()),
  observacoes: z.string().max(1000, "Máximo de 1000 caracteres."),

  /* ------------------------------------------------------------- contato */
  telefone: z
    .string()
    .min(1, CAMPO_OBRIGATORIO)
    .refine(telefoneValido, "Telefone inválido — informe DDD e número."),

  email: z.string().min(1, CAMPO_OBRIGATORIO).email("E-mail inválido."),

  /** Dispara o SMS de acesso ao app logo após salvar. */
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
  telefone: z.string().refine((valor) => !valor || telefoneValido(valor), "Telefone inválido."),
  email: z
    .string()
    .refine((valor) => !valor || z.string().email().safeParse(valor).success, "E-mail inválido."),
});

/** Formulário em branco. Convite marcado: é o padrão anunciado no cabeçalho. */
export const VALORES_INICIAIS: PacienteForm = {
  nome: "",
  cpf: "",
  nascimento: "",
  sexo: "feminino",
  cid: "",
  protocolo_id: "",
  fase: FASE_TRATAMENTO.ATIVO,
  risco: RISCO.BAIXO,
  estadiamento: "",
  diagnostico_em: "",
  medico_responsavel_id: "",
  alergias: [],
  reacoes_previas: [],
  observacoes: "",
  telefone: "",
  email: "",
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
    cpf: somenteDigitos(valores.cpf),
    nascimento: valores.nascimento,
    sexo: valores.sexo,
    telefone: somenteDigitos(valores.telefone),
    email: valores.email.trim().toLowerCase(),
    cid: valores.cid,
    protocolo_id: valores.protocolo_id,
    fase: valores.fase,
    risco: valores.risco,
    estadiamento: vazioComoNulo(valores.estadiamento),
    diagnostico_em: vazioComoNulo(valores.diagnostico_em),
    alergias: valores.alergias,
    reacoes_previas: valores.reacoes_previas,
    observacoes: vazioComoNulo(valores.observacoes),
    medico_responsavel_id: vazioComoNulo(valores.medico_responsavel_id),
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
    campos: ["nome", "cpf", "nascimento", "sexo"],
  },
  {
    id: "diagnostico",
    titulo: "Diagnóstico e tratamento",
    descricao: "CID-10, protocolo, fase e o histórico que a equipe precisa ver.",
    campos: [
      "cid",
      "protocolo_id",
      "fase",
      "risco",
      "estadiamento",
      "diagnostico_em",
      "medico_responsavel_id",
      "alergias",
      "reacoes_previas",
      "observacoes",
    ],
  },
  {
    id: "contato",
    titulo: "Contato e acesso",
    descricao: "Para onde vai o convite do aplicativo.",
    campos: ["telefone", "email", "enviar_convite"],
  },
] as const satisfies readonly {
  id: string;
  titulo: string;
  descricao: string;
  campos: readonly (keyof PacienteForm)[];
}[];
