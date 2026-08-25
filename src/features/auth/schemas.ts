import { z } from "zod";

/**
 * Validação dos formulários de autenticação.
 *
 * Zod é a primeira barreira: nada sai do formulário sem passar por aqui. O
 * backend valida de novo — validação de cliente é experiência do usuário, não
 * segurança —, mas evita requisição inútil e dá erro imediato no campo certo.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Informe seu e-mail corporativo.")
    .email("E-mail inválido.")
    .transform((valor) => valor.trim().toLowerCase()),
  senha: z.string().min(1, "Informe sua senha."),
});

export type LoginForm = z.infer<typeof loginSchema>;

export const mfaSchema = z.object({
  codigo: z
    .string()
    .length(6, "O código tem 6 dígitos.")
    .regex(/^\d{6}$/, "O código tem apenas números."),
});

export type MfaForm = z.infer<typeof mfaSchema>;

export const recuperarSenhaSchema = z.object({
  email: z
    .string()
    .min(1, "Informe seu e-mail corporativo.")
    .email("E-mail inválido.")
    .transform((valor) => valor.trim().toLowerCase()),
});

export type RecuperarSenhaForm = z.infer<typeof recuperarSenhaSchema>;

/**
 * Política de senha do painel.
 *
 * 10 caracteres com as quatro classes: é acesso a prontuário oncológico, não a
 * um fórum. As regras aparecem na tela como lista viva, marcando o que já foi
 * cumprido — assim a pessoa não descobre o requisito só ao errar.
 */
export const REGRAS_SENHA = [
  { id: "tamanho", label: "Pelo menos 10 caracteres", teste: (s: string) => s.length >= 10 },
  { id: "maiuscula", label: "Uma letra maiúscula", teste: (s: string) => /[A-Z]/.test(s) },
  { id: "minuscula", label: "Uma letra minúscula", teste: (s: string) => /[a-z]/.test(s) },
  { id: "numero", label: "Um número", teste: (s: string) => /\d/.test(s) },
  { id: "simbolo", label: "Um símbolo", teste: (s: string) => /[^A-Za-z0-9]/.test(s) },
] as const;

const senhaForte = z
  .string()
  .min(10, "A senha precisa ter pelo menos 10 caracteres.")
  .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
  .regex(/[a-z]/, "Inclua uma letra minúscula.")
  .regex(/\d/, "Inclua um número.")
  .regex(/[^A-Za-z0-9]/, "Inclua um símbolo.");

export const novaSenhaSchema = z
  .object({
    senha: senhaForte,
    confirmacao: z.string().min(1, "Repita a nova senha."),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    message: "As senhas não coincidem.",
    path: ["confirmacao"],
  });

export type NovaSenhaForm = z.infer<typeof novaSenhaSchema>;
