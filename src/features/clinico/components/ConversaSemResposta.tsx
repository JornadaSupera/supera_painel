import { MessageSquareReply } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import type { ConversaClinico } from "@/types/clinico";
import { useMarcarConversaLida } from "../hooks/useConversasClinicas";
import { ComposerMensagem } from "./ComposerMensagem";

/**
 * Uma conversa à espera de resposta, no painel do dia.
 *
 * "Responder" abre o mesmo campo do Chat, só com texto — anexo fica para a tela
 * de conversa. Responder também é ler: ao enviar, a conversa sai desta lista em
 * vez de continuar pedindo a resposta que acabou de sair.
 */
export function ConversaSemResposta({
  conversa,
  chatHref,
}: {
  conversa: ConversaClinico;
  chatHref: string;
}) {
  const [respondendo, setRespondendo] = useState(false);
  const marcarLida = useMarcarConversaLida();

  return (
    <li className="rounded-xl border">
      <div className="flex items-center gap-3 px-3 py-2 text-sm">
        <Link
          to={chatHref}
          className="hover:text-primary-ink flex min-w-0 flex-1 items-center gap-3 transition-colors"
        >
          <span className="min-w-0 flex-1 truncate">{conversa.paciente_nome}</span>
          <span className="text-muted-foreground shrink-0 text-xs">
            {conversa.assunto_label} · {relativeTime(conversa.ultima_mensagem_em)}
          </span>
        </Link>

        <Button
          type="button"
          variant={respondendo ? "secondary" : "ghost"}
          size="sm"
          aria-expanded={respondendo}
          aria-label={`Responder ${conversa.paciente_nome}`}
          onClick={() => setRespondendo((aberto) => !aberto)}
        >
          <MessageSquareReply />
          Responder
        </Button>
      </div>

      {respondendo && (
        <div className="border-t px-3 py-2">
          <ComposerMensagem
            conversaId={conversa.id}
            permitirAnexo={false}
            compacto
            onEnviada={() => {
              marcarLida.mutate(conversa.id);
              setRespondendo(false);
            }}
          />
        </div>
      )}
    </li>
  );
}

export default ConversaSemResposta;
