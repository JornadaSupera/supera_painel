import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { Ban, Check, FileText, Pencil, Plus, RotateCcw, X } from "lucide-react";

import {
  BackendPendente,
  EmptyState,
  ErrorState,
  Footnote,
  PageHeader,
  ScrollableTabsList,
  SkeletonCards,
  StatusBadge,
} from "@/components/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/format";
import { VOCABULARIO_TERMO, type VocabularioTermo } from "@/lib/enums";
import { cn } from "@/lib/utils";
import type { ItemCatalogo, VersaoLegal } from "@/types/configuracao";
import { ConsentimentosAceitos } from "../components/ConsentimentosAceitos";
import { DialogPublicarTermo } from "../components/DialogPublicarTermo";
import { ExigenciaSegundoFator } from "../components/ExigenciaSegundoFator";
import { FilaDeConferencia } from "../components/FilaDeConferencia";
import { GatilhosAlerta } from "../components/GatilhosAlerta";
import { IdentidadeEOperacao } from "../components/IdentidadeEOperacao";
import { MetasOperacionais } from "../components/MetasOperacionais";
import { MotivosSituacao } from "../components/MotivosSituacao";
import { NovoSintoma } from "../components/NovoSintoma";
import { SolicitacoesTitular } from "../components/SolicitacoesTitular";
import {
  useAtualizarTermoVocabulario,
  useConfiguracoes,
  useSetTermoVocabularioAtivo,
  useTermos,
} from "../hooks/useConfiguracoes";

/**
 * Configurações — o que está valendo no sistema.
 *
 * Protótipo: https://strawti.com.br/prototipos/jornada-supera/admin/configuracoes/
 *
 * > [!] A tela tem duas metades, e elas travam eixos diferentes.
 * O **vocabulário** (sintomas, notificações, categorias, assuntos, tipos de
 * compromisso) trava o CÓDIGO, não o resto — desde `update_vocabulary_term` e
 * `set_vocabulary_term_active` (25/09/2026): rótulo e ordem corrigem-se pelo
 * painel, e retirar/reativar é a mesma função nos dois sentidos. O código
 * continua fixo porque é ele que o diário do paciente, os eixos dos relatórios
 * e o alvo do gatilho de alerta usam para apontar para o mesmo item — trocá-lo
 * quebraria os três de uma vez. Termo novo continua exigindo migração
 * revisada: o conjunto de códigos válidos é fechado nesses três lugares.
 *
 * A **operação** — documento legal em vigor, grau que dispara alerta, motivos
 * de falta — é da clínica e muda com a rotina dela, sem nenhum código travado.
 * Esperar uma migração para cadastrar "paciente não tinha transporte" seria
 * burocracia sem finalidade.
 *
 * Identidade visual, mensagens e horário de atendimento — que o protótipo
 * oferece e o backend não guardava — ganharam onde gravar em 25/09/2026
 * (`clinic_settings`). Vivem na aba "Identidade & horário", com salvamento de
 * verdade, não mais nomeados como ausentes.
 *
 * A tela detalhada de permissões vive em `/usuarios`, na aba "Permissões por
 * papel", como o próprio protótipo antecipa ao dizer que ela viria depois.
 */

/** O que a tela de referência ainda oferece e o banco não guarda, se sobrar algum. */
const MOTIVOS_SEM_ORIGEM: Record<string, string> = {};

/** As duas espécies de documento, na ordem em que o aplicativo as pede. */
const ESPECIES_LEGAIS: { tipo: VersaoLegal["tipo"]; label: string }[] = [
  { tipo: "termos_de_uso", label: "Termos de uso" },
  { tipo: "politica_de_privacidade", label: "Política de privacidade" },
];

/**
 * One term of a vocabulary: its label and order are corrected in place.
 *
 * The database code stays off screen: it is an internal key, in english, and it
 * tells nothing to whoever runs the clinic. The label is what names the term,
 * for the eye and for the screen reader alike.
 */
function LinhaCatalogo({
  item,
  vocabulario,
  onPedirRetirada,
}: {
  item: ItemCatalogo;
  vocabulario: VocabularioTermo;
  onPedirRetirada: () => void;
}) {
  const atualizar = useAtualizarTermoVocabulario();
  const alternarAtivo = useSetTermoVocabularioAtivo();

  const [editando, setEditando] = useState(false);
  const [rascunhoLabel, setRascunhoLabel] = useState(item.label);
  const [rascunhoOrdem, setRascunhoOrdem] = useState(String(item.ordem));

  const cancelar = () => {
    setRascunhoLabel(item.label);
    setRascunhoOrdem(String(item.ordem));
    setEditando(false);
  };

  const salvar = () => {
    const label = rascunhoLabel.trim();
    const ordem = Number(rascunhoOrdem);

    const params: { vocabulario: VocabularioTermo; id: string; label?: string; ordem?: number } = {
      vocabulario,
      id: item.id,
    };
    if (label !== "" && label !== item.label) params.label = label;
    // Campo vazio não é "ordem zero" — `Number("")` é `0`, que passa em
    // `isFinite` sem que ninguém tenha digitado nada.
    if (rascunhoOrdem.trim() !== "" && Number.isFinite(ordem) && ordem !== item.ordem) {
      params.ordem = ordem;
    }

    // Nada mudou: fecha sem chamar o backend por uma escrita vazia.
    if (params.label === undefined && params.ordem === undefined) return setEditando(false);

    atualizar.mutate(params, { onSuccess: () => setEditando(false) });
  };

  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
      <div className="min-w-0 flex-1">
        {editando ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={rascunhoLabel}
              maxLength={60}
              className="h-8 min-w-0 flex-1 text-xs"
              aria-label={`Rótulo de ${item.label}`}
              onChange={(evento) => setRascunhoLabel(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter") salvar();
                if (evento.key === "Escape") cancelar();
              }}
            />
            <Input
              value={rascunhoOrdem}
              type="number"
              inputMode="numeric"
              min={0}
              className="h-8 w-14 shrink-0 text-xs"
              aria-label={`Ordem de ${item.label}`}
              onChange={(evento) => setRascunhoOrdem(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === "Enter") salvar();
                if (evento.key === "Escape") cancelar();
              }}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <p
              className={cn(
                "truncate text-xs font-medium",
                item.ativo ? "text-foreground" : "text-muted-foreground line-through",
              )}
            >
              {item.label}
            </p>
            {!item.ativo && (
              <StatusBadge tone="neutral" size="sm">
                Retirado
              </StatusBadge>
            )}
          </div>
        )}

        {!editando && item.detalhe && (
          <p className="text-muted-foreground truncate text-[11px]">{item.detalhe}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {editando ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Salvar termo"
              disabled={atualizar.isPending}
              onClick={salvar}
            >
              <Check />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Cancelar edição" onClick={cancelar}>
              <X />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Corrigir ${item.label}`}
              onClick={() => setEditando(true)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={alternarAtivo.isPending}
              onClick={() =>
                item.ativo
                  ? onPedirRetirada()
                  : alternarAtivo.mutate({ vocabulario, id: item.id, ativo: true })
              }
            >
              {item.ativo ? <Ban /> : <RotateCcw />}
              {item.ativo ? "Retirar" : "Reativar"}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * O que retirar um termo tira de circulação, por vocabulário — a mesma
 * repartição de `GRUPO_POR_VOCABULARIO` em `supabase/configuracoes.ts`, só
 * que aqui a saída é a frase que o diálogo de confirmação mostra.
 *
 * As cinco tabelas afetam superfícies diferentes: `notification_types` não
 * tem "diário" nem "chat" — retirá-lo para de enviar aquele aviso, ponto. Uma
 * frase genérica citando os quatro outros catálogos numa confirmação de
 * notificação estaria descrevendo o efeito errado bem na hora em que a pessoa
 * mais precisa confiar no que está lendo.
 */
const SUPERFICIE_POR_VOCABULARIO: Record<VocabularioTermo, string> = {
  symptoms: "Sai do diário: deixa de aparecer entre os sintomas que o paciente pode marcar.",
  notification_types:
    "Esse tipo de notificação para de ser enviado, para todo mundo — ninguém mais recebe o aviso desse evento.",
  content_categories: "Sai dos chips de filtro da biblioteca de orientações.",
  conversation_subjects: "Sai da lista de assuntos que o paciente escolhe ao abrir uma conversa no chat.",
  appointment_types: "Sai das opções de tipo de compromisso da agenda.",
};

/**
 * Uma lista de catálogo, em cartão — editável desde `update_vocabulary_term`.
 *
 * > [!] Retirar pede confirmação; reativar não.
 * As duas são a mesma RPC, mas não o mesmo risco: retirar tira o termo de
 * circulação para quem usa o aplicativo agora, na hora — e um clique errado
 * nesse sentido só se nota quando alguém reclama. Reativar é sempre
 * corretivo: é o clique que desfaz o errado, então não pede a mesma pausa.
 */
function Catalogo({
  titulo,
  descricao,
  itens,
  vocabulario,
  rodape,
}: {
  titulo: string;
  descricao: string;
  itens: ItemCatalogo[];
  vocabulario: VocabularioTermo;
  /** Below the list — the create form, for the vocabularies that have one. */
  rodape?: ReactNode;
}) {
  const retirar = useSetTermoVocabularioAtivo();
  // O termo aguardando confirmação de retirada. `null` = nenhum.
  const [retirando, setRetirando] = useState<ItemCatalogo | null>(null);

  const ativos = itens.filter((item) => item.ativo).length;

  return (
    <section className="bg-card rounded-2xl border p-5">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-foreground text-sm font-semibold">{titulo}</h2>
          <p className="text-muted-foreground text-xs">{descricao}</p>
        </div>

        {itens.length > 0 && (
          <span className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
            {ativos} de {itens.length} ativos
          </span>
        )}
      </header>

      {itens.length === 0 ? (
        <EmptyState compact title="Catálogo vazio" />
      ) : (
        <ul className="divide-border divide-y">
          {itens.map((item) => (
            <LinhaCatalogo
              key={item.id}
              item={item}
              vocabulario={vocabulario}
              onPedirRetirada={() => setRetirando(item)}
            />
          ))}
        </ul>
      )}

      {rodape && <div className="border-border mt-3 border-t pt-3">{rodape}</div>}

      <AlertDialog
        open={retirando !== null}
        onOpenChange={(estado) => {
          if (!estado) setRetirando(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirar “{retirando?.label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {SUPERFICIE_POR_VOCABULARIO[vocabulario]}
              <strong className="text-foreground mt-2 block font-medium">
                Reative a qualquer momento pelo mesmo botão: retirar não apaga nada, só tira de
                circulação.
              </strong>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={retirar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={retirar.isPending}
              onClick={() => {
                if (retirando) retirar.mutate({ vocabulario, id: retirando.id, ativo: false });
                setRetirando(null);
              }}
            >
              Retirar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

/** The tabs a link can open with `?aba=` — the bell sends the admin to "lgpd". */
const ABAS = [
  "identidade",
  "catalogos",
  "alertas",
  "metas",
  "motivos",
  "legais",
  "seguranca",
  "integracao",
  "lgpd",
] as const;

export function ConfiguracoesPage() {
  const configuracoes = useConfiguracoes();
  const [searchParams, setSearchParams] = useSearchParams();
  const pedida = searchParams.get("aba");
  const aba = ABAS.find((valor) => valor === pedida) ?? "catalogos";
  const trocarAba = (valor: string) =>
    setSearchParams(
      (atual) => {
        const proximo = new URLSearchParams(atual);
        proximo.set("aba", valor);
        return proximo;
      },
      { replace: true },
    );
  const termos = useTermos();

  const dados = configuracoes.data;

  // Qual espécie está com o diálogo de publicação aberto. `null` = nenhuma.
  const [publicando, setPublicando] = useState<VersaoLegal["tipo"] | null>(null);

  const vigenteDe = (tipo: VersaoLegal["tipo"]) =>
    (termos.data ?? []).find((versao) => versao.tipo === tipo && versao.vigente) ?? null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Sistema"
        title="Configurações"
        subtitle="Vocabulário do sistema, gatilhos de alerta, motivos de situação e documentos legais"
      />

      {configuracoes.isError && (
        <ErrorState error={configuracoes.error} onRetry={() => void configuracoes.refetch()} />
      )}

      <Tabs value={aba} onValueChange={trocarAba} className="flex flex-col gap-5">
        {/* Seven sections do not fit side by side below ~1100px. The list
            scrolls inside its own strip, so the page keeps its width. */}
        <ScrollableTabsList>
          <TabsTrigger value="identidade">Identidade & horário</TabsTrigger>
          <TabsTrigger value="catalogos">Catálogos do sistema</TabsTrigger>
          <TabsTrigger value="alertas">Gatilhos de alerta</TabsTrigger>
          <TabsTrigger value="metas">Metas operacionais</TabsTrigger>
          <TabsTrigger value="motivos">Motivos de situação</TabsTrigger>
          <TabsTrigger value="legais">Termos & privacidade</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
          <TabsTrigger value="integracao">Integração</TabsTrigger>
          <TabsTrigger value="lgpd">Pedidos do titular</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="identidade">
          <IdentidadeEOperacao />
        </TabsContent>

        <TabsContent value="catalogos" className="flex flex-col gap-5">
          {configuracoes.isLoading ? (
            <SkeletonCards count={5} />
          ) : (
            dados && (
              // `grid-cols-1` is `minmax(0, 1fr)`: the implicit column sized
              // itself to the longest technical code and pushed the cards
              // past a phone screen.
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Catalogo
                  titulo="Sintomas do diário"
                  descricao="Os sintomas que o paciente marca, e o eixo dos relatórios clínicos"
                  itens={dados.sintomas}
                  vocabulario={VOCABULARIO_TERMO.SINTOMAS}
                  rodape={<NovoSintoma />}
                />
                <Catalogo
                  titulo="Tipos de notificação"
                  descricao="O que o aplicativo envia, e o que não pode ser silenciado"
                  itens={dados.notificacoes}
                  vocabulario={VOCABULARIO_TERMO.NOTIFICACOES}
                />
                <Catalogo
                  titulo="Categorias de conteúdo"
                  descricao="Os chips de filtro da biblioteca de orientações"
                  itens={dados.categorias_conteudo}
                  vocabulario={VOCABULARIO_TERMO.CATEGORIAS_CONTEUDO}
                />
                <Catalogo
                  titulo="Assuntos do chat"
                  descricao="O que o paciente escolhe ao abrir uma conversa"
                  itens={dados.assuntos_chat}
                  vocabulario={VOCABULARIO_TERMO.ASSUNTOS_CHAT}
                />
                <Catalogo
                  titulo="Tipos de compromisso"
                  descricao="O que aparece na agenda, e o recorte do relatório de sessões de infusão"
                  itens={dados.tipos_compromisso}
                  vocabulario={VOCABULARIO_TERMO.TIPOS_COMPROMISSO}
                />
              </div>
            )
          )}

          {/* O que a tela de referência oferece e o backend não guarda. Cada
              item nomeado, para que se saiba o que pedir. */}
          {(dados?.sem_origem.length ?? 0) > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-foreground text-sm font-semibold">
                Ainda não configurável pelo painel
              </h2>

              {(dados?.sem_origem ?? []).map((chave) => (
                <BackendPendente
                  key={chave}
                  motivo={MOTIVOS_SEM_ORIGEM[chave] ?? "Esta configuração ainda não pode ser alterada pelo painel."}
                />
              ))}
            </div>
          )}

          <Footnote>
            Nome, ordem e o estado ativo/retirado dos itens acima mudam por aqui, e cada edição fica
            na auditoria. Itens novos não se cadastram por esta tela: o diário, os relatórios e os
            gatilhos de alerta dependem da lista, e a inclusão passa pela equipe técnica. As regras
            de permissão por papel ficam em{" "}
            <strong>Usuários → Permissões por papel</strong>.
          </Footnote>
        </TabsContent>

        <TabsContent value="alertas">
          <GatilhosAlerta />
        </TabsContent>

        <TabsContent value="metas">
          <MetasOperacionais />
        </TabsContent>

        <TabsContent value="motivos">
          <MotivosSituacao />
        </TabsContent>

        <TabsContent value="legais" className="flex flex-col gap-4">
          {/* Uma ação por espécie: termos e política evoluem em ritmos
              diferentes, e a numeração do backend é separada. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground max-w-[64ch] text-xs leading-relaxed">
              O documento em vigor é o que o aplicativo exibe no aceite. Publicar uma versão nova
              aposenta a anterior e exige que todos os pacientes aceitem de novo.
            </p>

            <div className="flex shrink-0 gap-2">
              {ESPECIES_LEGAIS.map((especie) => (
                <Button
                  key={especie.tipo}
                  variant="outline"
                  size="sm"
                  onClick={() => setPublicando(especie.tipo)}
                >
                  <Plus />
                  {especie.label}
                </Button>
              ))}
            </div>
          </div>

          {termos.isLoading && <SkeletonCards count={2} />}

          {termos.isError && (
            <ErrorState error={termos.error} onRetry={() => void termos.refetch()} />
          )}

          {!termos.isLoading && (termos.data?.length ?? 0) === 0 && (
            <EmptyState
              title="Nenhuma versão publicada"
              description="Não há termos de uso nem política de privacidade registrados. Enquanto não houver, o aplicativo não tem texto para exibir no aceite — e nenhum paciente deveria entrar antes disso."
            />
          )}

          {(termos.data ?? []).map((versao) => (
            <article key={versao.id} className="bg-card rounded-2xl border p-5">
              <header className="mb-3 flex flex-wrap items-center gap-2">
                <FileText size={15} aria-hidden="true" className="text-muted-foreground" />
                <h2 className="text-foreground text-sm font-semibold">{versao.tipo_label}</h2>

                <StatusBadge tone={versao.vigente ? "success" : "neutral"} size="sm" dot>
                  {versao.vigente ? "Em vigor" : "Histórico"}
                </StatusBadge>

                <span className="text-muted-foreground text-[11px] tabular-nums">
                  versão {versao.versao}
                  {versao.publicado_em && ` · publicada em ${formatDate(versao.publicado_em)}`}
                </span>
              </header>

              {/* Texto puro, em parágrafos: nada de `dangerouslySetInnerHTML`
                  num documento que vira aceite jurídico. */}
              <div className="max-h-56 overflow-y-auto pr-1">
                {versao.corpo
                  .split(/\n{2,}/)
                  .filter((trecho) => trecho.trim() !== "")
                  .map((paragrafo, indice) => (
                    <p
                      key={`${versao.id}-${indice}`}
                      className="text-muted-foreground mb-2 text-xs leading-relaxed last:mb-0"
                    >
                      {paragrafo}
                    </p>
                  ))}
              </div>
            </article>
          ))}

          <Footnote>
            O aceite é versionado: quem aceitou a versão anterior não aceitou a atual. É por isso
            que não existe "editar o texto vigente" — editar apagaria a prova do que cada pessoa
            aceitou, e o histórico acima é essa prova.
          </Footnote>

          {/* A contrapartida da publicação: uma cria a obrigação, a outra é a
              prova de que ela foi cumprida. */}
          <ConsentimentosAceitos />
        </TabsContent>

        <TabsContent value="seguranca">
          <ExigenciaSegundoFator />
        </TabsContent>

        <TabsContent value="integracao">
          <FilaDeConferencia />
        </TabsContent>

        <TabsContent value="lgpd">
          <SolicitacoesTitular />
        </TabsContent>
      </Tabs>

      {ESPECIES_LEGAIS.map((especie) => (
        <DialogPublicarTermo
          key={especie.tipo}
          tipo={especie.tipo}
          tipoLabel={especie.label}
          vigente={vigenteDe(especie.tipo)}
          aberto={publicando === especie.tipo}
          onFechar={() => setPublicando(null)}
        />
      ))}
    </div>
  );
}

export default ConfiguracoesPage;
