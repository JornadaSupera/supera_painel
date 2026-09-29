import { z } from "zod";

import { chatAttachmentError } from "@/lib/attachments";

/**
 * Validação da resposta no chat.
 *
 * O banco valida de novo — o corpo não pode ser vazio e o bucket recusa tipo e
 * tamanho —, mas mensagem e anexo não se apagam depois de gravados, então o que
 * dá para recusar aqui tem que ser recusado aqui.
 */

export const MENSAGEM_MAX = 2000;

export const mensagemSchema = z.object({
  corpo: z
    .string()
    .trim()
    .min(1, "Escreva a mensagem antes de enviar.")
    .max(MENSAGEM_MAX, `A mensagem tem no máximo ${MENSAGEM_MAX} caracteres.`),
  anexo: z
    .instanceof(File)
    .nullable()
    .superRefine((arquivo, ctx) => {
      const motivo = arquivo ? chatAttachmentError(arquivo) : null;
      if (motivo) ctx.addIssue({ code: z.ZodIssueCode.custom, message: motivo });
    }),
});

export type MensagemForm = z.infer<typeof mensagemSchema>;
