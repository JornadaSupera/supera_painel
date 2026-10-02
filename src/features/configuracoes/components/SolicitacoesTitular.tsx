import { useState } from "react";

import { Scale } from "lucide-react";

import { AlertTriangle } from "lucide-react";

import { ConfirmDialog, EmptyState, ErrorState, Footnote, SkeletonCards, StatusBadge } from "@/components/shared";
import type { ConfirmDialogProps } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDate, formatDateTime, relativeTime } from "@/lib/format";
import type { SolicitacaoTitular } from "@/types/configuracao";
import { downloadProgress, hasPendingDownload, type DownloadProgress } from "../downloadWindow";
import {
  useCompletarSolicitacao,
  useDecidirSolicitacao,
  useSolicitacoesTitular,
} from "../hooks/useConfiguracoes";
import { DetalhePedidoCorrecao } from "./DetalhePedidoCorrecao";

/**
 * Os pedidos que o titular abriu sobre os próprios dados.
 *
 * > [!] Esta fila existia antes desta tela, e ninguém a via.
 * O paciente abre o pedido pelo aplicativo — acesso, correção, portabilidade,
 * revogação de consentimento, exclusão — e o painel não tinha onde mostrá-lo.
 * Um pedido aberto e sem resposta **corre prazo legal**; não era uma pendência
 * de sistema, era descumprimento com data.
 *
 * > [!] Decidir não é cumprir — mas "cumprir" significa coisas diferentes por tipo.
 * Exclusão e revogação de consentimento se executam sozinhas, pela rotina
 * agendada (`execution_error` avisa aqui quando ela falha); correção pede o
 * botão "marcar como cumprida", que só aparece nela; acesso e portabilidade o
 * titular resolve sozinho, pelo app — o painel não tem o que fazer depois de
 * deferir, só acompanhar se o download aconteceu (`downloadProgress`).
 *
 * > [!] O que cada observação vira no app do paciente muda por tipo e decisão —
 * ver `configurarDecisao`. A recusa e a resposta da correção aparecem para ele;
 * a observação de um acesso deferido, não.
 */

/** Prazo usual de resposta ao titular. Serve para ordenar atenção, não para decidir. */
const PRAZO_DIAS = 15;

const AVISO_EXCLUSAO_SEM_DOWNLOAD =
  "Este paciente ainda não baixou os dados que pediu. A exclusão encerra a conta em até 5 minutos e, depois disso, ele não consegue mais baixar. Defira a exclusão só depois do download.";

const DICA_SEM_DADO_PESSOAL = "Não escreva o dado completo (CPF, celular).";

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Uma sequência longa de dígitos parece CPF ou telefone. Só avisa, não impede. */
function avisoDadoPessoal(texto: string): string | null {
  return /(?:\d[\s.\-()]*){10,}/.test(texto)
    ? "Isto parece um CPF ou telefone. A observação fica registrada e o paciente a lê no app: prefira não escrevê-lo."
    : null;
}

type ConfigDecisao = Pick<
  ConfirmDialogProps,
  | "reasonLabel"
  | "reasonPlaceholder"
  | "reasonHint"
  | "reasonOptional"
  | "reasonCaution"
  | "notice"
  | "confirmLabel"
  | "tone"
>;

/**
 * O diálogo de decisão: o rótulo diz a quem o texto se destina.
 *
 * Recusar: o motivo é obrigatório (sem ele o banco devolve `refusal_requires_reason`)
 * e o paciente o lê no app como "Motivo: …". Deferir correção: vira a "Resposta do
 * Centro". Deferir acesso ou portabilidade: o paciente não vê a observação, só o
 * botão de baixar. Exclusão e revogação: o app não diz que mostra a observação,
 * então ela fica como registro da decisão.
 */
function configurarDecisao(
  pedido: SolicitacaoTitular,
  deferir: boolean,
  exclusaoSemDownload: boolean,
): ConfigDecisao {
  if (!deferir) {
    return {
      tone: "danger",
      confirmLabel: "Recusar",
      reasonLabel: "Motivo para o paciente (aparece no app)",
      reasonPlaceholder: "Explique ao paciente por que o pedido foi recusado",
      reasonHint: `O paciente lê este texto no pedido, como “Motivo: …”. ${DICA_SEM_DADO_PESSOAL}`,
      reasonCaution: avisoDadoPessoal,
    };
  }

  if (pedido.tipo === "deletion" && exclusaoSemDownload) {
    return {
      tone: "danger",
      confirmLabel: "Deferir mesmo assim",
      notice: AVISO_EXCLUSAO_SEM_DOWNLOAD,
      reasonLabel: "Observação registrada com a decisão",
      reasonPlaceholder: "Por que deferir antes do download",
      reasonHint: "Fica registrada com a decisão.",
    };
  }

  if (pedido.tipo === "rectification") {
    return {
      tone: "warning",
      confirmLabel: "Deferir",
      reasonLabel: "Resposta ao paciente (aparece no app)",
      reasonPlaceholder: "Vamos corrigir o seu celular.",
      reasonHint: `O paciente lê este texto como “Resposta do Centro”. ${DICA_SEM_DADO_PESSOAL}`,
      reasonCaution: avisoDadoPessoal,
    };
  }

  if (pedido.tipo === "access" || pedido.tipo === "portability") {
    return {
      tone: "warning",
      confirmLabel: "Deferir",
      reasonLabel: "Observação interna (o paciente não vê)",
      reasonPlaceholder: "Registre o que justifica deferir",
      reasonHint:
        "Fica registrada com a decisão. O paciente vê só o botão de baixar os dados, por 15 dias.",
    };
  }

  return {
    tone: "warning",
    confirmLabel: "Deferir",
    reasonLabel: "Observação registrada com a decisão",
    reasonPlaceholder: "Registre o que justifica deferir",
    reasonHint: "Fica registrada com a decisão.",
  };
}

function Linha({
  solicitacao,
  progresso,
  onDecidir,
  onCompletar,
  onVerTexto,
}: {
  solicitacao: SolicitacaoTitular;
  progresso: DownloadProgress | null;
  onDecidir: (deferir: boolean) => void;
  onCompletar: () => void;
  onVerTexto: () => void;
}) {
  const dias = diasDesde(solicitacao.criado_em);
  const vencido = solicitacao.aberto && dias > PRAZO_DIAS;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground text-xs font-medium">{solicitacao.tipo_label}</p>

          <StatusBadge
            tone={solicitacao.aberto ? (vencido ? "danger" : "warning") : "neutral"}
            size="sm"
            dot={solicitacao.aberto}
          >
            {solicitacao.status_label}
          </StatusBadge>
        </div>

        <p className="text-muted-foreground mt-0.5 truncate text-[11px]">{solicitacao.pessoa}</p>

        <p className="text-muted-foreground text-[11px]">
          aberto {relativeTime(solicitacao.criado_em)} · {formatDate(solicitacao.criado_em)}
          {vencido && ` · ${dias} dias em aberto`}
        </p>

        {solicitacao.decidido_em && (
          <p className="text-muted-foreground mt-1 text-[11px]">
            decidido em {formatDateTime(solicitacao.decidido_em)}
            {solicitacao.decidido_por && ` · por ${solicitacao.decidido_por}`}
            {solicitacao.observacao && ` — “${solicitacao.observacao}”`}
          </p>
        )}

        {progresso && (
          <p
            className={
              progresso.state === "expired"
                ? "text-warning mt-1 text-[11px] font-medium"
                : progresso.state === "downloaded"
                  ? "text-success mt-1 text-[11px] font-medium"
                  : "text-foreground mt-1 text-[11px] font-medium"
            }
          >
            {progresso.label}
          </p>
        )}

        {solicitacao.execucao_erro && (
          <p className="text-destructive mt-1 flex items-start gap-1 text-[11px]">
            <AlertTriangle size={12} aria-hidden="true" className="mt-0.5 shrink-0" />
            <span>A execução automática falhou: {solicitacao.execucao_erro}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {solicitacao.tipo === "rectification" && (
          <Button variant="outline" size="sm" onClick={onVerTexto}>
            Ver o que corrigir
          </Button>
        )}

        {solicitacao.aberto && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDecidir(false)}
              className="text-destructive hover:text-destructive"
            >
              Recusar
            </Button>

            <Button size="sm" onClick={() => onDecidir(true)}>
              Deferir
            </Button>
          </>
        )}

        {solicitacao.completavel && (
          <Button size="sm" onClick={onCompletar}>
            Marcar como cumprida
          </Button>
        )}
      </div>
    </li>
  );
}

export function SolicitacoesTitular() {
  const { solicitacoes, isLoading, isError, error, refetch } = useSolicitacoesTitular();
  const decidir = useDecidirSolicitacao();
  const completar = useCompletarSolicitacao();

  // O pedido em decisão, e qual decisão. `null` = nenhum diálogo aberto.
  const [decisao, setDecisao] = useState<{ pedido: SolicitacaoTitular; deferir: boolean } | null>(
    null,
  );

  // O pedido em vias de ser marcado como cumprido. `null` = nenhum diálogo aberto.
  const [completando, setCompletando] = useState<SolicitacaoTitular | null>(null);

  // O pedido de correção aberto por dentro, com o texto do paciente.
  const [vendoTexto, setVendoTexto] = useState<SolicitacaoTitular | null>(null);

  if (isLoading) return <SkeletonCards count={1} />;

  if (isError) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const abertos = solicitacoes.filter((solicitacao) => solicitacao.aberto).length;

  // Uma só leitura do relógio por renderização: a lista e o aviso da exclusão
  // têm que concordar sobre quem ainda está dentro do prazo de download.
  const agora = Date.now();

  const config = decisao
    ? configurarDecisao(
        decisao.pedido,
        decisao.deferir,
        decisao.pedido.tipo === "deletion" &&
          hasPendingDownload(solicitacoes, decisao.pedido.conta_id, agora),
      )
    : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-card rounded-2xl border p-5">
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-foreground text-sm font-semibold">Pedidos do titular</h2>
            <p className="text-muted-foreground text-xs">
              Acesso, correção, portabilidade, revogação de consentimento e exclusão
            </p>
          </div>

          <StatusBadge
            tone={abertos > 0 ? "warning" : "success"}
            size="sm"
            dot={abertos > 0}
            className="shrink-0"
          >
            <Scale size={10} aria-hidden="true" className="mr-1" />
            {abertos} em aberto
          </StatusBadge>
        </header>

        {solicitacoes.length === 0 ? (
          <EmptyState
            compact
            title="Nenhum pedido registrado"
            description="Ninguém pediu acesso, correção ou exclusão dos próprios dados até agora."
          />
        ) : (
          <ul className="divide-border divide-y">
            {solicitacoes.map((solicitacao) => (
              <Linha
                key={solicitacao.id}
                solicitacao={solicitacao}
                progresso={downloadProgress(solicitacao, agora)}
                onDecidir={(deferir) => setDecisao({ pedido: solicitacao, deferir })}
                onCompletar={() => setCompletando(solicitacao)}
                onVerTexto={() => setVendoTexto(solicitacao)}
              />
            ))}
          </ul>
        )}
      </section>

      <Footnote>
        Deferir registra a decisão, não o cumprimento. Exclusão e revogação de consentimento se
        executam sozinhas, em até 5 minutos — esta tela avisa se a execução falhar. Correção pede
        o passo extra de marcar como cumprida, depois de o dado já estar corrigido na ficha do
        paciente. Acesso e portabilidade o paciente baixa sozinho, pelo app, em até 15 dias do
        deferimento — esta tela mostra se o download aconteceu.
      </Footnote>

      <DetalhePedidoCorrecao
        pedido={vendoTexto}
        onOpenChange={(aberto) => !aberto && setVendoTexto(null)}
      />

      <ConfirmDialog
        open={decisao !== null}
        onOpenChange={(aberto) => !aberto && setDecisao(null)}
        tone={config?.tone ?? "warning"}
        title={decisao?.deferir ? "Deferir o pedido?" : "Recusar o pedido?"}
        description={
          decisao
            ? `${decisao.pedido.tipo_label}, aberto por ${decisao.pedido.pessoa}. A decisão fica registrada.`
            : undefined
        }
        confirmLabel={config?.confirmLabel}
        notice={config?.notice}
        reasonLabel={config?.reasonLabel}
        reasonPlaceholder={config?.reasonPlaceholder}
        reasonHint={config?.reasonHint}
        reasonCaution={config?.reasonCaution}
        loading={decidir.isPending}
        onConfirm={({ reason }) => {
          if (decisao) {
            decidir.mutate({
              id: decisao.pedido.id,
              deferir: decisao.deferir,
              observacao: reason,
            });
          }
          setDecisao(null);
        }}
      />

      <ConfirmDialog
        open={completando !== null}
        onOpenChange={(aberto) => !aberto && setCompletando(null)}
        tone="warning"
        title="Marcar pedido de correção como cumprido?"
        description={
          completando
            ? `Correção aberta por ${completando.pessoa}. Confirme só depois de já ter corrigido o dado na ficha do paciente.`
            : undefined
        }
        confirmLabel="Marcar como cumprida"
        reasonLabel="Resposta ao paciente (aparece no app)"
        reasonPlaceholder="Corrigimos o seu celular."
        reasonHint={`Opcional. O paciente lê este texto como “Resposta do Centro”, no lugar da observação anterior. ${DICA_SEM_DADO_PESSOAL}`}
        reasonOptional
        reasonCaution={avisoDadoPessoal}
        loading={completar.isPending}
        onConfirm={({ reason }) => {
          if (completando) {
            completar.mutate({ id: completando.id, observacao: reason });
          }
          setCompletando(null);
        }}
      />
    </div>
  );
}

export default SolicitacoesTitular;
