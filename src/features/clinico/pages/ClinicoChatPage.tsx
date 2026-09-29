import { useEffect, useRef, useState } from "react";

import { EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { AUTOR_MENSAGEM, ESPECIALIDADE_LABEL, STATUS_CONVERSA_LABEL } from "@/lib/enums";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversaClinico } from "@/types/clinico";
import { AnexoDaMensagem } from "../components/AnexoDaMensagem";
import { ComposerMensagem } from "../components/ComposerMensagem";
import {
  useAssumirConversa,
  useConversasClinicas,
  useMarcarConversaLida,
  useMensagensClinicas,
  useResolverConversa,
} from "../hooks/useConversasClinicas";

/**
 * Conversas — fila compartilhada pela equipe, uma janela por paciente.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/farmaceutico/chat/
 *
 * > [!] A resposta é um INSERT direto, não uma RPC
 * O banco prevê assim: a política de INSERT em `messages` decide quem responde
 * (profissional ativo, conversa aberta, de equipe ou da própria especialidade).
 * Uma recusa dela — conversa encerrada, por exemplo — chega à tela como texto,
 * e o que a pessoa escreveu continua no campo.
 *
 * A conversa aberta e a lista se atualizam sozinhas de tempos em tempos; ver
 * `useConversasClinicas`.
 */

const RESUMO_AUTOR: Record<string, string> = {
  [AUTOR_MENSAGEM.PACIENTE]: "Paciente",
  [AUTOR_MENSAGEM.CUIDADOR]: "Cuidador",
  [AUTOR_MENSAGEM.PROFISSIONAL]: "Equipe",
  [AUTOR_MENSAGEM.SISTEMA]: "Sistema",
};

export function ClinicoChatPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const conversas = useConversasClinicas();
  const [selecionada, setSelecionada] = useState<string | null>(null);

  // A primeira conversa da lista abre sozinha assim que a fila carrega —
  // uma tela de conversas vazia à direita não convida ninguém a clicar.
  useEffect(() => {
    if (!selecionada && conversas.data && conversas.data.length > 0) {
      setSelecionada(conversas.data[0]?.id ?? null);
    }
  }, [conversas.data, selecionada]);

  const conversaAtual = conversas.data?.find((conversa) => conversa.id === selecionada) ?? null;

  const lista = conversas.data ?? [];
  const vazio = !conversas.isLoading && !conversas.isError && lista.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title="Chat"
        subtitle={`${lista.filter((c) => c.status === "aberta").length} conversas abertas`}
      />

      {conversas.isLoading && <Loading />}
      {conversas.isError && <ErrorState error={conversas.error} onRetry={() => void conversas.refetch()} />}
      {vazio && (
        <EmptyState
          title="Nenhuma conversa"
          description="Quando um paciente abrir uma conversa, ela aparece aqui."
        />
      )}

      {lista.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <ListaConversas
            conversas={lista}
            selecionadaId={selecionada}
            onSelecionar={setSelecionada}
          />

          {conversaAtual ? (
            // `key`: o campo de resposta e a leitura são de UMA conversa; sem
            // ela, o rascunho de uma seguiria para a outra ao trocar na lista.
            <PainelConversa key={conversaAtual.id} conversa={conversaAtual} />
          ) : (
            <div className="bg-card hidden items-center justify-center rounded-2xl border p-8 lg:flex">
              <p className="text-muted-foreground text-sm">Selecione uma conversa.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListaConversas({
  conversas,
  selecionadaId,
  onSelecionar,
}: {
  conversas: ConversaClinico[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}) {
  return (
    <div className="bg-card flex max-h-[70vh] flex-col overflow-y-auto rounded-2xl border">
      {conversas.map((conversa) => (
        <button
          key={conversa.id}
          type="button"
          onClick={() => onSelecionar(conversa.id)}
          className={cn(
            "border-border/60 flex flex-col gap-1 border-b p-3 text-left transition-colors last:border-b-0",
            conversa.id === selecionadaId ? "bg-primary/10" : "hover:bg-muted/60",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-foreground truncate text-sm font-medium">{conversa.paciente_nome}</p>
            {conversa.nao_lida_pela_equipe && (
              <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="Não lida" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge tone={conversa.status_tom} size="sm">
              {STATUS_CONVERSA_LABEL[conversa.status]}
            </StatusBadge>
            <span className="text-muted-foreground truncate text-xs">{conversa.assunto_label}</span>
          </div>
          <p className="text-muted-foreground text-[11px]">{relativeTime(conversa.ultima_mensagem_em)}</p>
        </button>
      ))}
    </div>
  );
}

function PainelConversa({ conversa }: { conversa: ConversaClinico }) {
  const { user } = useAuth();
  const mensagens = useMensagensClinicas(conversa.id);
  const assumir = useAssumirConversa();
  const resolver = useResolverConversa();
  const marcarLida = useMarcarConversaLida();

  // Abrir a conversa é o próprio ato de ler — não exige clique à parte. Também
  // vale para a mensagem que chega com ela aberta: sem isso, a atualização
  // periódica a deixaria marcada como não lida enquanto alguém a está vendo.
  useEffect(() => {
    if (conversa.nao_lida_pela_equipe) marcarLida.mutate(conversa.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversa.id, conversa.nao_lida_pela_equipe]);

  // A conversa cresce para baixo: a mensagem nova é a que se quer ver.
  const fimRef = useRef<HTMLDivElement>(null);
  const total = mensagens.data?.length ?? 0;
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [total]);

  const aberta = conversa.status === "aberta";
  const daMinhaEspecialidade =
    conversa.especialidade_origem !== null && conversa.especialidade_origem === user?.especialidade;
  const deOutraEspecialidade = conversa.especialidade_origem !== null && !daMinhaEspecialidade;

  return (
    <div className="bg-card flex max-h-[70vh] flex-col rounded-2xl border">
      <header className="border-border flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div>
          <p className="text-foreground text-sm font-semibold">{conversa.paciente_nome}</p>
          <p className="text-muted-foreground text-xs">
            {conversa.assunto_label}
            {deOutraEspecialidade &&
              conversa.especialidade_origem &&
              ` · com ${ESPECIALIDADE_LABEL[conversa.especialidade_origem]}`}
          </p>
        </div>

        <div className="flex gap-2">
          {!conversa.atribuida && aberta && (
            <Button size="sm" onClick={() => assumir.mutate(conversa.id)} disabled={assumir.isPending}>
              Assumir
            </Button>
          )}
          {/* Only the specialty the conversation was routed to can resolve it —
              the backend refuses anyone else, and an unassigned one belongs to
              nobody yet. Offering the button elsewhere only led to a refusal. */}
          {aberta && daMinhaEspecialidade && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolver.mutate(conversa.id)}
              disabled={resolver.isPending}
            >
              Marcar resolvida
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensagens.isLoading && <Loading compact />}
        {mensagens.isError && (
          <ErrorState compact error={mensagens.error} onRetry={() => void mensagens.refetch()} />
        )}

        {(mensagens.data ?? []).map((mensagem) => {
          const daEquipe = mensagem.autor === "profissional";
          const doSistema = mensagem.autor === "sistema";

          return (
            <div
              key={mensagem.id}
              className={cn("flex flex-col gap-0.5", daEquipe ? "items-end" : "items-start")}
            >
              {doSistema ? (
                <p className="text-muted-foreground mx-auto text-[11px] italic">{mensagem.corpo}</p>
              ) : (
                <>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                      daEquipe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                    )}
                  >
                    <p className="break-words whitespace-pre-wrap">{mensagem.corpo}</p>
                    {mensagem.anexos.length > 0 && (
                      <div className="mt-2 flex flex-col items-start gap-2">
                        {mensagem.anexos.map((anexo) => (
                          <AnexoDaMensagem key={anexo.id} anexo={anexo} daEquipe={daEquipe} />
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {RESUMO_AUTOR[mensagem.autor]} · {formatDateTime(mensagem.criado_em)}
                  </span>
                </>
              )}
            </div>
          );
        })}

        <div ref={fimRef} />
      </div>

      <footer className="border-border border-t p-3">
        {aberta ? (
          <ComposerMensagem conversaId={conversa.id} />
        ) : (
          <p className="text-muted-foreground text-xs">
            Esta conversa foi encerrada. Só o paciente pode abrir uma nova.
          </p>
        )}
      </footer>
    </div>
  );
}

export default ClinicoChatPage;
