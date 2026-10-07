import { Forward, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import chatGlass from "@/assets/images/chat-bamboo-glass.webp";
import {
  EmptyState,
  ErrorState,
  FilterChip,
  FilterChipGroup,
  Loading,
  PageHeader,
  SearchInput,
  SkeletonRows,
  StatusBadge,
  UserAvatar,
  type StatusTone,
} from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useTargetLookup } from "@/hooks/useTargetLookup";
import { AUTOR_MENSAGEM, ESPECIALIDADE_LABEL, STATUS_CONVERSA_LABEL } from "@/lib/enums";
import { formatDateTime, formatNumber, relativeTime } from "@/lib/format";
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
  useLerNotificacoesDaConversa,
  useMarcarConversaLida,
  useMensagensClinicas,
  useResolverConversa,
  useTempoDeResposta,
} from "../hooks/useConversasClinicas";

/**
 * Conversas — fila compartilhada pela equipe, uma janela por paciente.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/clinico/psicologo/chat/
 *
 * > [!] A resposta é um INSERT direto, não uma RPC
 * O banco prevê assim: a política de INSERT em `messages` decide quem responde
 * (profissional ativo, conversa aberta, de equipe ou da própria especialidade).
 * Uma recusa dela — conversa encerrada, por exemplo — chega à tela como texto,
 * e o que a pessoa escreveu continua no campo.
 *
 * A conversa aberta e a lista se atualizam sozinhas de tempos em tempos; ver
 * `useConversasClinicas`.
 *
 * A tela abre na fila em largura total, como no protótipo; clicar numa conversa
 * a abre ao lado de uma fila estreita, e "Voltar à fila" fecha. Busca e recortes
 * ficam acima das duas formas e valem para as duas.
 *
 * `?conversa=<id>` é o endereço que a notificação abre: a conversa já vem
 * selecionada. Quando ela não está na fila de quem abriu (assumida por outro,
 * ou encaminhada e resolvida por quem a recebeu), a tela diz por quê.
 */

const RESUMO_AUTOR: Record<string, string> = {
  [AUTOR_MENSAGEM.PACIENTE]: "Paciente",
  [AUTOR_MENSAGEM.CUIDADOR]: "Cuidador",
  [AUTOR_MENSAGEM.PROFISSIONAL]: "Equipe",
  [AUTOR_MENSAGEM.SISTEMA]: "Sistema",
};

/** "2 pendentes · tempo médio de resposta 18 min". Pendente: aberta, com mensagem nova do paciente. */
function subtituloDaFila(lista: ConversaClinico[], minutos: number | null | undefined): string {
  const pendentes = lista.filter((c) => c.status === "aberta" && c.nao_lida_pela_equipe).length;
  const base = `${pendentes} ${pendentes === 1 ? "pendente" : "pendentes"}`;
  if (minutos === undefined) return base;
  return minutos === null
    ? `${base} · tempo médio de resposta: sem respostas no mês`
    : `${base} · tempo médio de resposta ${formatNumber(minutos)} min`;
}

/** Como a conversa está para quem a lê na fila: a cor acompanha, nunca substitui, o texto. */
function situacao(conversa: ConversaClinico): { label: string; tone: StatusTone } {
  if (conversa.status === "resolvida") return { label: STATUS_CONVERSA_LABEL.resolvida, tone: "success" };
  if (conversa.nao_lida_pela_equipe) return { label: "Aguarda resposta", tone: "danger" };
  return { label: STATUS_CONVERSA_LABEL.aberta, tone: "info" };
}

/** "atribuída a você", "na fila", ou nada quando a conversa não está com ninguém em particular. */
function comQuem(conversa: ConversaClinico): string | null {
  if (conversa.minha) return "atribuída a você";
  if (!conversa.atribuida && conversa.status === "aberta") return "na fila";
  return null;
}

const RECORTES: { value: RecorteDeConversas; label: string }[] = [
  { value: "todas", label: "Todas" },
  { value: "nao_resolvidas", label: "Não resolvidas" },
  { value: "minhas", label: "Atribuídas a mim" },
  { value: "da_minha_area", label: "Da minha área" },
];

const FILTRO_INICIAL: FiltroDeConversas = {
  busca: "",
  recorte: "todas",
  assunto: TODOS_OS_ASSUNTOS,
  paciente: null,
};

export function ClinicoChatPage() {
  const { user } = useAuth();
  const area = user?.especialidade ? ESPECIALIDADE_LABEL[user.especialidade] : "";

  const conversas = useConversasClinicas();
  const tempoDeResposta = useTempoDeResposta();
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDeConversas>(FILTRO_INICIAL);
  const [encaminhar, setEncaminhar] = useState<ConversaClinico | null>(null);

  // A ficha do paciente leva para cá com `?paciente=`. Um paciente pode ter
  // conversas com mais de uma área ao mesmo tempo: a lista passa a mostrar só as
  // dele, e abre a que é sua, senão a da sua área, senão a mais recente — a lista
  // já vem da mais recente para a mais antiga. Sem o parâmetro, a tela abre na
  // fila inteira, como no protótipo, e a conversa abre ao clicar.
  const [searchParams, setSearchParams] = useSearchParams();
  const pacienteDaFicha = searchParams.get("paciente");
  const doPaciente = pacienteDaFicha
    ? (conversas.data ?? []).filter((conversa) => conversa.paciente_id === pacienteDaFicha)
    : [];
  const conversaDoPaciente =
    doPaciente.find((conversa) => conversa.minha) ??
    doPaciente.find((conversa) => conversa.especialidade_origem === user?.especialidade) ??
    doPaciente[0];

  const [abriuDaFicha, setAbriuDaFicha] = useState(false);
  useEffect(() => {
    if (!abriuDaFicha && conversaDoPaciente) {
      setSelecionada(conversaDoPaciente.id);
      setFiltro((atual) => ({ ...atual, paciente: conversaDoPaciente.paciente_id }));
      setAbriuDaFicha(true);
    }
  }, [abriuDaFicha, conversaDoPaciente]);

  // A notificação leva para cá com `?conversa=`: a conversa abre já
  // selecionada. Se ela ainda não veio na leitura, a lista é lida de novo uma
  // vez antes de a tela dizer que não a encontrou.
  const conversaPedida = searchParams.get("conversa");
  const encaminhada = searchParams.get("encaminhada") === "1";
  const conversaDaNotificacao = conversaPedida
    ? ((conversas.data ?? []).find((conversa) => conversa.id === conversaPedida) ?? null)
    : null;
  const lookup = useTargetLookup({
    id: conversaPedida,
    found: conversaDaNotificacao !== null,
    settled: Boolean(conversas.data) && !conversas.isFetching,
    refetch: () => conversas.refetch(),
  });

  const abertaPelaNotificacao = useRef<string | null>(null);
  useEffect(() => {
    if (!conversaDaNotificacao || abertaPelaNotificacao.current === conversaDaNotificacao.id) return;
    abertaPelaNotificacao.current = conversaDaNotificacao.id;
    setSelecionada(conversaDaNotificacao.id);
  }, [conversaDaNotificacao]);

  function esquecerConversaPedida() {
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        proximo.delete("conversa");
        proximo.delete("encaminhada");
        return proximo;
      },
      { replace: true },
    );
  }

  const lista = conversas.data ?? [];
  const conversaAtual = lista.find((conversa) => conversa.id === selecionada) ?? null;
  const vazio = !conversas.isLoading && !conversas.isError && lista.length === 0;

  const assuntos = assuntosDaLista(lista);
  const visiveis = filtrarConversas(lista, filtro, user?.especialidade ?? null);
  const filtrando =
    filtro.busca.trim() !== "" ||
    filtro.recorte !== "todas" ||
    filtro.assunto !== TODOS_OS_ASSUNTOS ||
    filtro.paciente !== null;
  const nomeDoPacienteFiltrado = filtro.paciente
    ? lista.find((conversa) => conversa.paciente_id === filtro.paciente)?.paciente_nome
    : undefined;
  const minutos = tempoDeResposta.isSuccess ? tempoDeResposta.data?.minutos : undefined;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={area ? `${area} · Chat` : "Chat"}
        title="Conversas"
        subtitle={subtituloDaFila(lista, minutos)}
      />

      {pacienteDaFicha && conversas.data && !conversaDoPaciente && (
        <Alert role="status">
          <AlertDescription>
            Este paciente ainda não tem conversa com a equipe. A fila abaixo mostra as demais.
          </AlertDescription>
        </Alert>
      )}

      {!conversas.isLoading && (lookup === "searching" || lookup === "missing") && (
        <Alert role="status" className="flex items-start justify-between gap-3">
          <AlertDescription>
            {lookup === "searching"
              ? "Procurando a conversa da notificação…"
              : encaminhada
                ? "A conversa que você encaminhou foi resolvida por quem a recebeu. Ela ficou com essa pessoa e não aparece mais na sua fila."
                : "A conversa da notificação não está na sua fila. Uma conversa assumida por outro profissional fica só com quem a assumiu."}
          </AlertDescription>
          {lookup === "missing" && (
            <Button
              variant="ghost"
              size="icon"
              className="-my-1 size-7 shrink-0"
              aria-label="Fechar o aviso"
              onClick={esquecerConversaPedida}
            >
              <X />
            </Button>
          )}
        </Alert>
      )}

      {conversas.isLoading && <SkeletonRows count={4} />}
      {conversas.isError && <ErrorState error={conversas.error} onRetry={() => void conversas.refetch()} />}
      {vazio && (
        <EmptyState
          title="Nenhuma conversa"
          description="Quando um paciente abrir uma conversa, ela aparece aqui."
        />
      )}

      {lista.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            <SearchInput
              value={filtro.busca}
              onChange={(busca) => setFiltro({ ...filtro, busca })}
              placeholder="Buscar conversa por paciente…"
              label="Buscar conversa por paciente"
              className="max-w-none"
            />

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {filtro.paciente && (
                <FilterChipGroup label="Paciente" className="sm:border-r sm:pr-4">
                  <FilterChip active onClick={() => setFiltro({ ...filtro, paciente: null })}>
                    <span className="inline-flex items-center gap-1">
                      Só {nomeDoPacienteFiltrado ?? "este paciente"}
                      <X size={12} aria-hidden="true" />
                      <span className="sr-only">, tirar o filtro</span>
                    </span>
                  </FilterChip>
                </FilterChipGroup>
              )}

              <FilterChipGroup label="Mostrar conversas">
                {RECORTES.map((recorte) => (
                  <FilterChip
                    key={recorte.value}
                    active={filtro.recorte === recorte.value}
                    onClick={() => setFiltro({ ...filtro, recorte: recorte.value })}
                  >
                    {recorte.label}
                  </FilterChip>
                ))}
              </FilterChipGroup>

              {/* Um assunto só não é recorte: com todas as conversas num assunto, a ficha
                  repetiria a lista inteira. */}
              {assuntos.length > 1 && (
                <FilterChipGroup label="Assunto" className="sm:border-l sm:pl-4">
                  {assuntos.map((assunto) => (
                    <FilterChip
                      key={assunto}
                      active={filtro.assunto === assunto}
                      onClick={() =>
                        setFiltro({
                          ...filtro,
                          assunto: filtro.assunto === assunto ? TODOS_OS_ASSUNTOS : assunto,
                        })
                      }
                    >
                      {assunto}
                    </FilterChip>
                  ))}
                </FilterChipGroup>
              )}
            </div>

            {/* Filtrar é escolher entre o que chegou. Com a leitura no teto, pode haver
                conversa que nem chegou, e a lista filtrada não deve parecer completa. */}
            {(filtrando || lista.length >= LIMITE_DA_LEITURA) && (
              <p className="text-muted-foreground text-xs" role="status">
                {`${visiveis.length} de ${lista.length} conversas carregadas${
                  lista.length >= LIMITE_DA_LEITURA ? ". A leitura entrega no máximo 200: pode haver mais." : ""
                }`}
              </p>
            )}
          </div>

          {conversaAtual ? (
            <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
              <ListaConversas
                conversas={visiveis}
                selecionadaId={conversaAtual.id}
                onSelecionar={setSelecionada}
              />
              {/* `key`: o campo de resposta e a leitura são de UMA conversa; sem
                  ela, o rascunho de uma seguiria para a outra ao trocar na lista. */}
              <PainelConversa
                key={conversaAtual.id}
                conversa={conversaAtual}
                onFechar={() => setSelecionada(null)}
              />
            </div>
          ) : (
            <ListaDaFila conversas={visiveis} onAbrir={setSelecionada} onEncaminhar={setEncaminhar} />
          )}
        </>
      )}

      {encaminhar && (
        <TransferConversationDialog
          conversation={encaminhar}
          open
          onOpenChange={(open) => !open && setEncaminhar(null)}
        />
      )}
    </div>
  );
}

/**
 * A fila em largura total, como no protótipo: quem, sobre o quê, com quem está,
 * quando e em que situação. O texto das mensagens não aparece aqui — lê-lo para
 * cada conversa seria uma leitura de conteúdo clínico por linha, só para uma
 * prévia; ele aparece ao abrir a conversa.
 */
function ListaDaFila({
  conversas,
  onAbrir,
  onEncaminhar,
}: {
  conversas: ConversaClinico[];
  onAbrir: (id: string) => void;
  onEncaminhar: (conversa: ConversaClinico) => void;
}) {
  if (conversas.length === 0) {
    return (
      <EmptyState
        compact
        variant="search"
        title="Nenhuma conversa no recorte"
        description="Nenhuma conversa corresponde à busca e aos filtros."
      />
    );
  }

  return (
    <ul className="bg-card divide-y overflow-hidden rounded-2xl border">
      {conversas.map((conversa) => {
        const { label, tone } = situacao(conversa);
        const quem = comQuem(conversa);

        return (
          <li key={conversa.id} className="flex items-start gap-3 px-4 py-3.5">
            <button
              type="button"
              onClick={() => onAbrir(conversa.id)}
              aria-label={`Abrir a conversa de ${conversa.paciente_nome} sobre ${conversa.assunto_label}`}
              className="focus-visible:ring-ring flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left focus-visible:ring-2 focus-visible:outline-none"
            >
              <UserAvatar name={conversa.paciente_nome} size="md" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-sm">
                  <span className={cn(conversa.nao_lida_pela_equipe ? "font-semibold" : "font-medium")}>
                    {conversa.paciente_nome}
                  </span>
                  <span className="text-muted-foreground"> · {conversa.assunto_label}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs">
                  <StatusBadge tone="neutral" size="sm" pill className="bg-card">
                    {conversa.assunto_label}
                  </StatusBadge>
                  {quem && <span className="text-muted-foreground">· {quem}</span>}
                </span>
              </span>
            </button>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">{relativeTime(conversa.ultima_mensagem_em)}</span>
                <StatusBadge tone={tone} size="sm" pill>
                  {label}
                </StatusBadge>
              </div>
              {/* Encaminhar é de quem está com a conversa. */}
              {conversa.status === "aberta" && conversa.minha && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-7"
                  onClick={() => onEncaminhar(conversa)}
                >
                  <Forward />
                  Encaminhar
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** A fila estreita, ao lado da conversa aberta: para trocar de conversa sem voltar. */
function ListaConversas({
  conversas,
  selecionadaId,
  onSelecionar,
}: {
  conversas: ConversaClinico[];
  selecionadaId: string;
  onSelecionar: (id: string) => void;
}) {
  return (
    <div className="bg-card flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border">
      <div className="flex flex-col overflow-y-auto">
        {conversas.length === 0 && (
          <p className="text-muted-foreground p-4 text-center text-xs">
            Nenhuma conversa corresponde à busca e aos filtros.
          </p>
        )}

        {conversas.map((conversa) => (
          <button
            key={conversa.id}
            type="button"
            onClick={() => onSelecionar(conversa.id)}
            aria-current={conversa.id === selecionadaId ? "true" : undefined}
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
                conversa.nao_lida_pela_equipe
                  ? "text-primary-ink font-medium"
                  : "text-muted-foreground",
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

function PainelConversa({ conversa, onFechar }: { conversa: ConversaClinico; onFechar: () => void }) {
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

  // E o que a anunciou no sino ("Conversa atribuída a você") deixa de ser
  // novo, tenha ela sido aberta pela notificação ou pela fila.
  const lerNotificacoes = useLerNotificacoesDaConversa();
  useEffect(() => {
    lerNotificacoes(conversa.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversa.id]);

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

        <div className="flex flex-wrap gap-2">
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
          <Button size="sm" variant="ghost" onClick={onFechar} aria-label="Fechar a conversa e voltar à fila">
            <X />
            <span className="max-sm:sr-only">Voltar à fila</span>
          </Button>
        </div>
      </header>

      <ConversationAssignments conversationId={conversa.id} />

      {/* Frosted glass with bamboo, the partitions between the clinic rooms. It sits on the
          scrolling box, so it stays still while the messages move; bubbles stay opaque and loose
          text over it goes dark. Light theme only: the photograph would glare in the dark one,
          and `!` is what lets the class beat the inline image. */}
      <div
        className="flex-1 space-y-3 overflow-y-auto bg-cover bg-center p-4 dark:bg-none!"
        style={{ backgroundImage: `url(${chatGlass})` }}
      >
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
                  className="text-primary-ink flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase"
                >
                  <span aria-hidden="true" className="bg-primary/30 h-px flex-1" />
                  <span className="bg-card rounded-full px-2 py-0.5">Mensagens novas</span>
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
                  <p className="text-foreground/80 mx-auto text-[11px] italic">{mensagem.corpo}</p>
                ) : (
                  <>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                        daEquipe
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border-border dark:bg-muted border shadow-xs",
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
                    <span className="text-foreground/80 text-[10px]">
                      {nova && (
                        <span className="text-primary-ink font-semibold uppercase">Nova · </span>
                      )}
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
