import { z } from "zod";

import { attachmentError } from "@/lib/attachments";
import {
  CONTENT_BODY_MAX,
  CONTENT_READING_MINUTES_MAX,
  CONTENT_TITLE_MAX,
  isSupportedVideoUrl,
} from "@/lib/content";
import { TIPO_CONTEUDO } from "@/lib/enums";
import type { PersonalBlock } from "@/types/agenda";
import {
  addDays,
  BLOCK_LABEL_MAX,
  blockError,
  dayStart,
  instantParts,
  minutesOfTime,
  timeOfMinutes,
  zonedInstant,
} from "@/lib/agenda";
import { SPECIALTY_NOTE_MAX } from "@/lib/patient-record";

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

/* -------------------------------------------------------------------------
   ANOTAÇÃO DA FICHA
   ------------------------------------------------------------------------- */

/**
 * Anotação pontual de uma especialidade. A nota não se edita nem se apaga depois
 * de salva, então o limite e o vazio são recusados aqui, com a regra que os dois
 * adapters repetem (`specialtyNoteError`).
 */
export const specialtyNoteSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Escreva a anotação antes de salvar.")
    .max(SPECIALTY_NOTE_MAX, `A anotação tem no máximo ${SPECIALTY_NOTE_MAX} caracteres.`),
  flagDistress: z.boolean(),
});

export type SpecialtyNoteForm = z.infer<typeof specialtyNoteSchema>;

/* -------------------------------------------------------------------------
   ENCAMINHAR CONVERSA
   ------------------------------------------------------------------------- */

export const transferConversationSchema = z.object({
  professionalId: z.string().min(1, "Escolha para quem encaminhar."),
});

export type TransferConversationForm = z.infer<typeof transferConversationSchema>;

/* -------------------------------------------------------------------------
   BLOQUEIO PESSOAL
   ------------------------------------------------------------------------- */

const DATE_FIELD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");
const TIME_FIELD = z.string().regex(/^\d{2}:\d{2}$/, "Informe a hora.");

/**
 * Um bloqueio é um intervalo que a pessoa marca como indisponível. Vale para
 * mais de um dia (férias, congresso), e "dia inteiro" dispensa as horas.
 */
export const blockSchema = z
  .object({
    label: z.string().trim().max(BLOCK_LABEL_MAX, `O motivo tem no máximo ${BLOCK_LABEL_MAX} caracteres.`),
    allDay: z.boolean(),
    startDate: DATE_FIELD,
    startTime: TIME_FIELD,
    endDate: DATE_FIELD,
    endTime: TIME_FIELD,
  })
  .superRefine((values, ctx) => {
    const input = blockFormToInput(values);
    const problem = blockError(input);
    if (problem) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: problem });
  });

export type BlockForm = z.infer<typeof blockSchema>;

/** The form is in the clinic's wall clock; the database stores instants. */
export function blockFormToInput(values: BlockForm): { label: string | null; starts_at: string; ends_at: string } {
  const label = values.label.trim() || null;

  if (values.allDay) {
    return {
      label,
      starts_at: dayStart(values.startDate),
      // Through the end of the last day: midnight of the day after.
      ends_at: dayStart(addDays(values.endDate, 1)),
    };
  }

  return {
    label,
    starts_at: zonedInstant(values.startDate, minutesOfTime(values.startTime)),
    ends_at: zonedInstant(values.endDate, minutesOfTime(values.endTime)),
  };
}

export function blockToFormValues(block: PersonalBlock | null, defaultDay: string): BlockForm {
  if (!block) {
    return {
      label: "",
      allDay: false,
      startDate: defaultDay,
      startTime: "09:00",
      endDate: defaultDay,
      endTime: "10:00",
    };
  }

  const start = instantParts(block.starts_at);
  const end = instantParts(block.ends_at);
  // A block that ends exactly at midnight ends on the day before, as a person reads it.
  const endsAtMidnight = end.minutes === 0;
  const allDay = start.minutes === 0 && endsAtMidnight;

  return {
    label: block.label ?? "",
    allDay,
    startDate: start.key,
    startTime: timeOfMinutes(start.minutes),
    endDate: endsAtMidnight ? addDays(end.key, -1) : end.key,
    endTime: endsAtMidnight ? "23:59" : timeOfMinutes(end.minutes),
  };
}
