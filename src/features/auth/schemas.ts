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
 * Comprimento apenas: nenhuma classe de caractere é exigida, e uma senha só de
 * dígitos passa. Quem sustenta o acesso é o segundo fator, obrigatório no
 * login — composição obrigatória empurra para o padrão previsível que a pessoa
 * consegue lembrar e para a senha anotada ao lado da estação de trabalho, sem
 * entregar a entropia que promete.
 *
 * > [!] O servidor tem a palavra final.
 * O provedor de autenticação aplica o mínimo configurado no projeto e recusa o
 * que estiver abaixo dele, ainda que esta validação aceite. Afrouxar aqui sem
 * afrouxar lá apenas move a recusa do formulário para o servidor, onde ela
 * chega como "senha fraca" depois do envio.
 *
 * A regra aparece na tela como lista viva, marcando o que já foi cumprido —
 * assim a pessoa não descobre o requisito só ao errar.
 */
export const PANEL_PASSWORD_MIN_LENGTH = 6;

export const REGRAS_SENHA = [
  {
    id: "tamanho",
    label: `Pelo menos ${PANEL_PASSWORD_MIN_LENGTH} caracteres`,
    teste: (s: string) => s.length >= PANEL_PASSWORD_MIN_LENGTH,
  },
] as const;

const senhaDoPainel = z
  .string()
  .min(
    PANEL_PASSWORD_MIN_LENGTH,
    `A senha precisa ter pelo menos ${PANEL_PASSWORD_MIN_LENGTH} caracteres.`,
  );

export const novaSenhaSchema = z
  .object({
    senha: senhaDoPainel,
    confirmacao: z.string().min(1, "Repita a nova senha."),
  })
  .refine((dados) => dados.senha === dados.confirmacao, {
    message: "As senhas não coincidem.",
    path: ["confirmacao"],
  });

export type NovaSenhaForm = z.infer<typeof novaSenhaSchema>;

/**
 * Password policy for app accounts (patients and caregivers).
 *
 * Length only. The panel's stricter rule protects staff access to clinical
 * records; the app reaches a different audience and follows its own policy.
 */
export const APP_PASSWORD_MIN_LENGTH = 8;

export const appPasswordSchema = z
  .object({
    password: z
      .string()
      .min(APP_PASSWORD_MIN_LENGTH, `A senha precisa ter pelo menos ${APP_PASSWORD_MIN_LENGTH} caracteres.`),
    confirmation: z.string().min(1, "Repita a senha."),
  })
  .refine((values) => values.password === values.confirmation, {
    message: "As senhas não coincidem.",
    path: ["confirmation"],
  });

export type AppPasswordForm = z.infer<typeof appPasswordSchema>;
