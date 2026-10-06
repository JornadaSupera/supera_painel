import { Search } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { AUTOR_MENSAGEM, ESPECIALIDADE_LABEL, STATUS_CONVERSA_LABEL } from "@/lib/enums";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConversaClinico, MensagemClinico } from "@/types/clinico";
import { AnexoDaMensagem } from "../components/AnexoDaMensagem";
import { ComposerMensagem } from "../components/ComposerMensagem";
import { ConversationAssignments } from "../components/ConversationAssignments";
import { TransferConversationDialog } from "../components/TransferConversationDialog";
import {
  LIMITE_DA_LEITURA,
  TODOS_OS_ASSUNTOS,
  assuntosDaLista,
  filtrarConversas,
  type FiltroDeConversas,
  type RecorteDeConversas,
} from "../filtroDeConversas";
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

function subtituloDaFila(lista: ConversaClinico[]): string {
  const abertas = lista.filter((c) => c.status === "aberta");
  const novas = abertas.filter((c) => c.nao_lida_pela_equipe).length;
  const base = `${abertas.length} ${abertas.length === 1 ? "conversa aberta" : "conversas abertas"}`;

  if (novas === 0) return base;
  return `${base} · ${novas} com ${novas === 1 ? "mensagem nova" : "mensagens novas"}`;
}

export function ClinicoChatPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const conversas = useConversasClinicas();
  const [selecionada, setSelecionada] = useState<string | null>(null);

  // A ficha do paciente leva para cá com `?paciente=`: a conversa dele abre no
  // lugar da primeira da fila. A lista vem da mais recente para a mais antiga,
  // então o primeiro que casa é a conversa mais recente daquele paciente.
  const pacienteDaFicha = useSearchParams()[0].get("paciente");
  const conversaDoPaciente = pacienteDaFicha
    ? conversas.data?.find((conversa) => conversa.paciente_id === pacienteDaFicha)
    : undefined;

  // A primeira conversa da lista abre sozinha assim que a fila carrega —
  // uma tela de conversas vazia à direita não convida ninguém a clicar.
  useEffect(() => {
    if (!selecionada && conversas.data && conversas.data.length > 0) {
      setSelecionada((conversaDoPaciente ?? conversas.data[0])?.id ?? null);
    }
  }, [conversas.data, conversaDoPaciente, selecionada]);

  const conversaAtual = conversas.data?.find((conversa) => conversa.id === selecionada) ?? null;

  const lista = conversas.data ?? [];
  const vazio = !conversas.isLoading && !conversas.isError && lista.length === 0;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area}
        title="Chat"
        subtitle={subtituloDaFila(lista)}
      />

      {pacienteDaFicha && conversas.data && !conversaDoPaciente && (
        <Alert role="status">
          <AlertDescription>
            Este paciente ainda não tem conversa com a equipe. A fila abaixo mostra as demais.
          </AlertDescription>
        </Alert>
      )}

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

const RECORTES: { value: RecorteDeConversas; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "minhas", label: "Minhas" },
  { value: "nao_resolvidas", label: "Não resolvidas" },
  { value: "da_minha_area", label: "Da minha área" },
];

function ListaConversas({
  conversas,
  selecionadaId,
  onSelecionar,
}: {
  conversas: ConversaClinico[];
  selecionadaId: string | null;
  onSelecionar: (id: string) => void;
}) {
  const { user } = useAuth();
  const [filtro, setFiltro] = useState<FiltroDeConversas>({
    busca: "",
    recorte: "todas",
    assunto: TODOS_OS_ASSUNTOS,
  });

  const assuntos = assuntosDaLista(conversas);
  const visiveis = filtrarConversas(conversas, filtro, user?.especialidade ?? null);
  const filtrando =
    filtro.busca.trim() !== "" || filtro.recorte !== "todas" || filtro.assunto !== TODOS_OS_ASSUNTOS;

  return (
    <div className="bg-card flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border">
      <div className="border-border flex flex-col gap-2 border-b p-3">
        <div className="relative">
          <Search
            size={14}
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2"
          />
          <Input
            type="search"
            value={filtro.busca}
            onChange={(evento) => setFiltro({ ...filtro, busca: evento.target.value })}
            placeholder="Buscar paciente"
            aria-label="Buscar conversa por paciente"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select
            value={filtro.recorte}
            onValueChange={(valor) => setFiltro({ ...filtro, recorte: valor as RecorteDeConversas })}
          >
            <SelectTrigger size="sm" aria-label="Mostrar conversas" className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECORTES.map((recorte) => (
                <SelectItem key={recorte.value} value={recorte.value}>
                  {recorte.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filtro.assunto} onValueChange={(valor) => setFiltro({ ...filtro, assunto: valor })}>
            <SelectTrigger size="sm" aria-label="Assunto" className="w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_OS_ASSUNTOS}>Todos os assuntos</SelectItem>
              {assuntos.map((assunto) => (
                <SelectItem key={assunto} value={assunto}>
                  {assunto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filtrar é escolher entre o que chegou. Com a leitura no teto, pode haver
            conversa que nem chegou, e a lista filtrada não deve parecer completa. */}
        {(filtrando || conversas.length >= LIMITE_DA_LEITURA) && (
          <p className="text-muted-foreground text-[11px]" role="status">
            {`${visiveis.length} de ${conversas.length} conversas carregadas${
              conversas.length >= LIMITE_DA_LEITURA ? ". A leitura entrega no máximo 200: pode haver mais." : ""
            }`}
          </p>
        )}
      </div>

      <div className="flex flex-col overflow-y-auto">
        {visiveis.length === 0 && (
          <p className="text-muted-foreground p-4 text-center text-xs">
            Nenhuma conversa corresponde à busca e aos filtros.
          </p>
        )}

        {visiveis.map((conversa) => (
          <button
            key={conversa.id}
            type="button"
            onClick={() => onSelecionar(conversa.id)}
            className={cn(
              "border-border/60 relative flex flex-col gap-1 border-b p-3 text-left transition-colors last:border-b-0",
              conversa.id === selecionadaId
                ? "bg-primary/10"
                : conversa.nao_lida_pela_equipe
                  ? "bg-primary/5 hover:bg-primary/10"
                  : "hover:bg-muted/60",
            )}
          >
            {/* A conversa com mensagem nova ganha uma faixa na borda, o nome em
                negrito e a etiqueta: o ponto sozinho passava despercebido. */}
            {conversa.nao_lida_pela_equipe && (
              <span aria-hidden="true" className="bg-primary absolute inset-y-0 left-0 w-1" />
            )}
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  "text-foreground truncate text-sm",
                  conversa.nao_lida_pela_equipe ? "font-semibold" : "font-medium",
                )}
              >
                {conversa.paciente_nome}
              </p>
              {conversa.nao_lida_pela_equipe && (
                <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Nova
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone={conversa.status_tom} size="sm">
                {STATUS_CONVERSA_LABEL[conversa.status]}
              </StatusBadge>
              <span className="text-muted-foreground truncate text-xs">{conversa.assunto_label}</span>
            </div>
            <p
              className={cn(
                "text-[11px]",
                conversa.nao_lida_pela_equipe ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              {relativeTime(conversa.ultima_mensagem_em)}
              {conversa.minha && " · com você"}
              {!conversa.atribuida && conversa.status === "aberta" && " · na fila"}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function PainelConversa({ conversa }: { conversa: ConversaClinico }) {
  const { user } = useAuth();
  const mensagens = useMensagensClinicas(conversa.id);
  const assumir = useAssumirConversa();
  const resolver = useResolverConversa();
  const marcarLida = useMarcarConversaLida();
  const [encaminhando, setEncaminhando] = useState(false);

  // O que é "novo" nesta conversa: o que chegou depois da última leitura da
  // equipe, e o que chega com ela aberta (a atualização periódica traz). Os dois
  // pontos de corte são fixados na abertura — marcar a conversa como lida, logo
  // em seguida, não apaga a marca de quem acabou de abrir.
  const [lidaAte] = useState(conversa.equipe_lida_em);
  const [jaVistas, setJaVistas] = useState<ReadonlySet<string> | null>(null);
  useEffect(() => {
    if (!jaVistas && mensagens.data) setJaVistas(new Set(mensagens.data.map((m) => m.id)));
  }, [jaVistas, mensagens.data]);

  const ehNova = (mensagem: MensagemClinico): boolean => {
    if (mensagem.autor === AUTOR_MENSAGEM.PROFISSIONAL || mensagem.autor === AUTOR_MENSAGEM.SISTEMA) {
      return false;
    }
    if (jaVistas && !jaVistas.has(mensagem.id)) return true;
    return lidaAte === null || mensagem.criado_em > lidaAte;
  };

  const primeiraNovaId = (mensagens.data ?? []).find(ehNova)?.id ?? null;

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
  const deOutraEspecialidade =
    conversa.especialidade_origem !== null && conversa.especialidade_origem !== user?.especialidade;

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
          {/* The conversation belongs to who claimed it: only that person resolves
              or hands it over. An unclaimed one belongs to nobody yet. */}
          {aberta && conversa.minha && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => resolver.mutate(conversa.id)}
              disabled={resolver.isPending}
            >
              Marcar resolvida
            </Button>
          )}
          {aberta && conversa.minha && (
            <Button size="sm" variant="outline" onClick={() => setEncaminhando(true)}>
              Encaminhar
            </Button>
          )}
        </div>
      </header>

      <ConversationAssignments conversationId={conversa.id} />

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensagens.isLoading && <Loading compact />}
        {mensagens.isError && (
          <ErrorState compact error={mensagens.error} onRetry={() => void mensagens.refetch()} />
        )}

        {(mensagens.data ?? []).map((mensagem) => {
          const daEquipe = mensagem.autor === "profissional";
          const doSistema = mensagem.autor === "sistema";
          const nova = ehNova(mensagem);

          return (
            <Fragment key={mensagem.id}>
              {mensagem.id === primeiraNovaId && (
                <div
                  role="separator"
                  aria-label="Mensagens novas"
                  className="text-primary flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase"
                >
                  <span aria-hidden="true" className="bg-primary/30 h-px flex-1" />
                  Mensagens novas
                  <span aria-hidden="true" className="bg-primary/30 h-px flex-1" />
                </div>
              )}
              <div
                className={cn(
                  "flex flex-col gap-0.5",
                  daEquipe ? "items-end" : "items-start",
                  nova &&
                    "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300",
                )}
              >
                {doSistema ? (
                  <p className="text-muted-foreground mx-auto text-[11px] italic">{mensagem.corpo}</p>
                ) : (
                  <>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        daEquipe ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                        nova && "ring-primary/40 ring-2",
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
                      {nova && <span className="text-primary font-semibold uppercase">Nova · </span>}
                      {RESUMO_AUTOR[mensagem.autor]}
                      {mensagem.autor_nome ? ` · ${mensagem.autor_nome}` : ""} ·{" "}
                      {formatDateTime(mensagem.criado_em)}
                    </span>
                  </>
                )}
              </div>
            </Fragment>
          );
        })}

        <div ref={fimRef} />
      </div>

      <TransferConversationDialog
        conversation={conversa}
        open={encaminhando}
        onOpenChange={setEncaminhando}
      />

      <footer className="border-border border-t p-3">
        {!aberta ? (
          <p className="text-muted-foreground text-xs">
            Esta conversa foi encerrada. Só o paciente pode abrir uma nova.
          </p>
        ) : conversa.minha ? (
          <ComposerMensagem conversaId={conversa.id} />
        ) : conversa.atribuida ? (
          <p className="text-muted-foreground text-xs">
            Esta conversa está com outro profissional. Só quem a assumiu responde.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Assuma a conversa para responder. Quem assume passa a ser o único a vê-la e a responder.
          </p>
        )}
      </footer>
    </div>
  );
}

export default ClinicoChatPage;
