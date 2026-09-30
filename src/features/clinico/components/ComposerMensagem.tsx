import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, LoaderCircle, Paperclip, SendHorizontal, X } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ATTACHMENT_ACCEPT, formatFileSize } from "@/lib/attachments";
import { cn } from "@/lib/utils";
import { mensagemJaEnviada, useEnviarMensagem } from "../hooks/useConversasClinicas";
import { MENSAGEM_MAX, mensagemSchema, type MensagemForm } from "../schemas";

/**
 * Campo de resposta do chat.
 *
 * Serve à tela de Chat, com anexo, e ao painel do dia, só com texto — é o mesmo
 * envio nos dois lugares, para o profissional não ter um caminho que grava de um
 * jeito e outro de outro.
 *
 * Enter envia, Shift+Enter quebra a linha. O texto só sai do campo quando a
 * mensagem saiu: numa recusa do banco (conversa encerrada, por exemplo) o que a
 * pessoa escreveu continua lá.
 */
export function ComposerMensagem({
  conversaId,
  permitirAnexo = true,
  compacto = false,
  placeholder = "Escreva a resposta ao paciente",
  onEnviada,
}: {
  conversaId: string;
  permitirAnexo?: boolean;
  compacto?: boolean;
  placeholder?: string;
  onEnviada?: () => void;
}) {
  const enviar = useEnviarMensagem();
  const seletorRef = useRef<HTMLInputElement>(null);

  const form = useForm<MensagemForm>({
    resolver: zodResolver(mensagemSchema),
    defaultValues: { corpo: "", anexo: null },
  });

  const { register, handleSubmit, setValue, watch, reset, formState } = form;
  const anexo = watch("anexo");
  const tamanhoDoTexto = watch("corpo").length;

  const submeter = handleSubmit((dados) => {
    enviar.mutate(
      { conversaId, corpo: dados.corpo, anexo: dados.anexo ?? undefined },
      {
        onSuccess: () => {
          reset();
          onEnviada?.();
        },
        // A mensagem saiu e só o anexo falhou: manter o texto convidaria a
        // enviá-la de novo, e o banco não apaga a primeira.
        onError: (erro) => {
          if (mensagemJaEnviada(erro)) reset();
        },
      },
    );
  });

  const aoTeclar = (evento: KeyboardEvent<HTMLTextAreaElement>) => {
    if (evento.key !== "Enter" || evento.shiftKey || evento.nativeEvent.isComposing) return;
    evento.preventDefault();
    if (!enviar.isPending) void submeter();
  };

  const erroDoTexto = formState.errors.corpo?.message;
  const erroDoAnexo = formState.errors.anexo?.message;

  return (
    <form onSubmit={submeter} noValidate className="flex flex-col gap-1.5">
      <Textarea
        {...register("corpo")}
        rows={compacto ? 1 : 2}
        placeholder={placeholder}
        aria-label="Resposta ao paciente"
        aria-invalid={Boolean(erroDoTexto)}
        aria-describedby="composer-ajuda"
        disabled={enviar.isPending}
        onKeyDown={aoTeclar}
        className={cn("resize-none", compacto && "min-h-9 py-1.5 text-sm")}
      />

      {anexo && (
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs">
          <FileText className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{anexo.name}</span>
          <span className="text-muted-foreground shrink-0">{formatFileSize(anexo.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remover anexo"
            disabled={enviar.isPending}
            onClick={() => setValue("anexo", null, { shouldValidate: true })}
          >
            <X />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        {permitirAnexo && (
          <>
            <input
              ref={seletorRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              aria-label="Escolher arquivo para anexar à mensagem"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(evento) => {
                const arquivo = evento.target.files?.[0] ?? null;
                evento.target.value = "";
                if (arquivo) setValue("anexo", arquivo, { shouldValidate: true });
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={enviar.isPending}
              onClick={() => seletorRef.current?.click()}
            >
              <Paperclip />
              Anexar
            </Button>
          </>
        )}

        <p
          id="composer-ajuda"
          role={erroDoTexto || erroDoAnexo ? "alert" : undefined}
          className={cn(
            "min-w-0 flex-1 text-[11px]",
            erroDoTexto || erroDoAnexo ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {erroDoTexto ??
            erroDoAnexo ??
            (tamanhoDoTexto >= MENSAGEM_MAX - 200
              ? `${tamanhoDoTexto} de ${MENSAGEM_MAX} caracteres`
              : permitirAnexo
                ? "Enter envia · Shift+Enter quebra a linha · PNG, JPEG, WebP ou PDF até 20 MB"
                : "Enter envia · Shift+Enter quebra a linha")}
        </p>

        <Button type="submit" size="sm" disabled={enviar.isPending}>
          {enviar.isPending ? <LoaderCircle className="animate-spin" /> : <SendHorizontal />}
          Enviar
        </Button>
      </div>
    </form>
  );
}

export default ComposerMensagem;
