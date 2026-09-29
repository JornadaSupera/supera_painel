import { z } from "zod";

import { attachmentError } from "@/lib/attachments";
import {
  CONTENT_BODY_MAX,
  CONTENT_READING_MINUTES_MAX,
  CONTENT_TITLE_MAX,
  isSupportedVideoUrl,
} from "@/lib/content";
import { TIPO_CONTEUDO } from "@/lib/enums";

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
      const motivo = arquivo ? attachmentError(arquivo) : null;
      if (motivo) ctx.addIssue({ code: z.ZodIssueCode.custom, message: motivo });
    }),
});

export type MensagemForm = z.infer<typeof mensagemSchema>;

/* -------------------------------------------------------------------------
   ORIENTAÇÃO
   ------------------------------------------------------------------------- */

/**
 * Validação do formulário de orientação.
 *
 * As mesmas regras que os dois adapters conferem (`invalidContentEntry`) e que o
 * banco impõe como CHECK: aqui a pessoa as vê no campo, lá elas são a última
 * barreira. O vídeo só é obrigatório quando o tipo é vídeo.
 */
export const orientacaoSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(1, "Informe o título da orientação.")
      .max(CONTENT_TITLE_MAX, `O título tem no máximo ${CONTENT_TITLE_MAX} caracteres.`),
    categoria_id: z.string().min(1, "Escolha a categoria."),
    tipo: z.enum([TIPO_CONTEUDO.ARTIGO, TIPO_CONTEUDO.VIDEO, TIPO_CONTEUDO.PDF]),
    corpo: z
      .string()
      .trim()
      .min(1, "Escreva o texto da orientação.")
      .max(CONTENT_BODY_MAX, `O texto tem no máximo ${CONTENT_BODY_MAX} caracteres.`),
    video_url: z.string().trim(),
    minutos_leitura: z
      .number()
      .int("Use um número inteiro de minutos.")
      .min(1, "O tempo de leitura é de pelo menos 1 minuto.")
      .max(CONTENT_READING_MINUTES_MAX, `O tempo de leitura vai até ${CONTENT_READING_MINUTES_MAX} minutos.`)
      .nullable(),
    cids: z.array(z.string()),
  })
  .superRefine((valores, ctx) => {
    if (valores.tipo !== TIPO_CONTEUDO.VIDEO) return;

    if (!valores.video_url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["video_url"], message: "Informe o link do vídeo." });
    } else if (!isSupportedVideoUrl(valores.video_url)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["video_url"],
        message: "Use um link https do YouTube ou do Vimeo.",
      });
    }
  });

export type OrientacaoForm = z.infer<typeof orientacaoSchema>;
