import { formatDate, formatTime } from "@/lib/format";
import type { SolicitacaoTitular } from "@/types/configuracao";

/**
 * O download dos dados do titular, nos pedidos de acesso e de portabilidade.
 *
 * O painel só decide. Deferido o pedido, o paciente vê no app o botão "Baixar
 * meus dados" por 15 dias, contados de `decided_at`; o banco monta o pacote na
 * hora e o primeiro download grava `executed_at`. Passado o prazo o banco recusa
 * o download e o pedido continua `granted` — não há estado "expirado" lá.
 * "Prazo encerrado sem download" é, portanto, uma conta feita aqui.
 */

/** Dias em que o botão de baixar fica disponível ao paciente. Regra do banco. */
export const DOWNLOAD_WINDOW_DAYS = 15;

const DAY_MS = 86_400_000;

const EXPORT_TYPES: ReadonlySet<string> = new Set(["access", "portability"]);

export type DownloadState = "available" | "downloaded" | "expired";

export interface DownloadProgress {
  state: DownloadState;
  /** Frase pronta para a linha do pedido. */
  label: string;
}

/** "02/10" — a tela fala de prazo, e o ano só pesa na linha. */
function dayAndMonth(iso: string): string {
  return formatDate(iso).slice(0, 5);
}

/**
 * Onde está o download de um pedido de acesso ou portabilidade já deferido.
 * `null` para qualquer outro tipo, e para o pedido que ainda espera decisão ou
 * foi recusado — não há download a acompanhar.
 */
export function downloadProgress(
  request: SolicitacaoTitular,
  now: number = Date.now(),
): DownloadProgress | null {
  if (!EXPORT_TYPES.has(request.tipo)) return null;

  if (request.executado_em) {
    return {
      state: "downloaded",
      label: `Baixado pelo paciente em ${dayAndMonth(request.executado_em)}, ${formatTime(request.executado_em)}`,
    };
  }

  if (request.status !== "granted" || !request.decidido_em) return null;

  const deadline = new Date(request.decidido_em).getTime() + DOWNLOAD_WINDOW_DAYS * DAY_MS;

  if (now > deadline) {
    return { state: "expired", label: "Prazo encerrado sem download" };
  }

  return {
    state: "available",
    label: `Disponível para o paciente até ${dayAndMonth(new Date(deadline).toISOString())}`,
  };
}

/**
 * Esta conta ainda tem dados para baixar?
 *
 * Verdadeiro para um pedido de acesso ou portabilidade que espera decisão, ou
 * que foi deferido e segue dentro do prazo sem download. É o que torna perigoso
 * deferir a exclusão: ela encerra a conta em até 5 minutos, e depois disso o
 * paciente não baixa mais nada.
 */
export function hasPendingDownload(
  requests: readonly SolicitacaoTitular[],
  accountId: string,
  now: number = Date.now(),
): boolean {
  return requests.some((request) => {
    if (request.conta_id !== accountId || !EXPORT_TYPES.has(request.tipo)) return false;
    if (request.aberto) return true;

    return downloadProgress(request, now)?.state === "available";
  });
}
