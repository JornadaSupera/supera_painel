import { CheckCircle2, Clock, LoaderCircle, Send, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { EmptyState, ErrorState, SkeletonRows, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  SPECIALTY_FIELD_LABEL,
  TIPO_CONTEUDO,
  TIPO_CONTEUDO_LABEL,
  type Especialidade,
} from "@/lib/enums";
import { formatDate, formatDuration, pluralize } from "@/lib/format";
import type { DirectedSend, SendableContent } from "@/types/directed-content";
import { CONTENT_KIND_ICON } from "../content-kind-icons";
import {
  useDirectedSends,
  useSendableContent,
  useSendDirectedContent,
} from "../hooks/useDirectedContent";

/**
 * Library orientations sent straight to the patient's app, from one area.
 *
 * Nutrition sends orientations, suggested from the library with the ones tagged
 * for the patient's diagnosis first. Physiotherapy releases exercise videos,
 * which become the home plan. Both read the same sends, and both say only what
 * the database knows: that the patient OPENED a send, and when — not that they
 * watched it to the end or did the exercise.
 *
 * Only the area's own professionals send; anyone else sees what was sent.
 */

export type DirectedContentVariant = "orientations" | "exercises";

/** How many suggestions show before "Ver todas". */
const SUGGESTIONS_SHOWN = 5;

interface Props {
  patientId: string;
  patientFirstName: string;
  /** ICD-10 codes of the patient's diagnoses: what puts a suggestion first. */
  patientCids: string[];
  /** The area of the space this card sits in. */
  specialty: Especialidade;
  /** The viewer works in this area — the only case in which they can send. */
  own: boolean;
  variant: DirectedContentVariant;
}

function OpenedBadge({ send }: { send: DirectedSend }) {
  return send.opened_at ? (
    <StatusBadge tone="success" size="sm">
      <CheckCircle2 size={12} aria-hidden="true" />
      Abriu em {formatDate(send.opened_at)}
    </StatusBadge>
  ) : (
    <StatusBadge tone="neutral" size="sm">
      <Clock size={12} aria-hidden="true" />
      Ainda não abriu
    </StatusBadge>
  );
}

function SentItem({ send }: { send: DirectedSend }) {
  const Icon = send.kind ? CONTENT_KIND_ICON[send.kind] : CONTENT_KIND_ICON.artigo;

  return (
    <li className="flex items-start gap-3 py-3">
      <span
        aria-hidden="true"
        className="bg-muted text-primary-ink flex size-8 shrink-0 items-center justify-center rounded-lg"
      >
        <Icon size={15} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{send.title ?? "Orientação sem versão legível"}</p>
        <p className="text-muted-foreground text-xs">
          {send.minutes ? `${formatDuration(send.minutes)} · ` : ""}
          Enviada por {send.sent_by_name} em {formatDate(send.sent_at)}
          {!send.published && " · saiu da biblioteca e não aparece mais no app"}
        </p>
      </div>
      <OpenedBadge send={send} />
    </li>
  );
}

/** Why a library item is offered: the patient's diagnosis first, then its place in the library. */
function reasonOf(content: SendableContent, matched: string[]): string {
  if (matched.length > 0) return `Marcada para o diagnóstico do paciente (${matched.join(", ")})`;
  const minutes = content.minutes ? ` · ${formatDuration(content.minutes)}` : "";
  return `${content.category} · ${TIPO_CONTEUDO_LABEL[content.kind]}${minutes}`;
}

function LibraryList({
  items,
  patientCids,
  sentItemIds,
  sendingItemId,
  sendLabel,
  limit,
  onSend,
}: {
  items: SendableContent[];
  patientCids: string[];
  sentItemIds: Set<string>;
  sendingItemId: string | null;
  sendLabel: string;
  limit: number | null;
  onSend: (content: SendableContent) => void;
}) {
  const ranked = useMemo(
    () =>
      items
        .map((content) => ({ content, matched: content.cids.filter((cid) => patientCids.includes(cid)) }))
        .sort((a, b) => b.matched.length - a.matched.length),
    [items, patientCids],
  );
  const shown = limit === null ? ranked : ranked.slice(0, limit);

  return (
    <ul className="divide-y">
      {shown.map(({ content, matched }) => {
        const Icon = CONTENT_KIND_ICON[content.kind];
        const sent = sentItemIds.has(content.content_item_id);
        const sending = sendingItemId === content.content_item_id;

        return (
          <li key={content.content_item_id} className="flex flex-wrap items-center gap-3 py-3">
            <Icon size={16} aria-hidden="true" className="text-muted-foreground shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium">{content.title}</p>
              <p className="text-muted-foreground text-xs">{reasonOf(content, matched)}</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={sent || sendingItemId !== null}
              onClick={() => onSend(content)}
            >
              {sending ? <LoaderCircle className="animate-spin" /> : sent ? <CheckCircle2 /> : <Send />}
              {sent ? "Já enviada" : sendLabel}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

export function DirectedContentCard({
  patientId,
  patientFirstName,
  patientCids,
  specialty,
  own,
  variant,
}: Props) {
  const exercises = variant === "exercises";
  const field = SPECIALTY_FIELD_LABEL[specialty];

  const [showAll, setShowAll] = useState(false);
  const [picking, setPicking] = useState(false);

  const sends = useDirectedSends(patientId);
  const library = useSendableContent(specialty, own);
  const send = useSendDirectedContent(patientId);

  const areaSends = useMemo(
    () => (sends.data ?? []).filter((item) => item.specialty === specialty),
    [sends.data, specialty],
  );
  const sentItemIds = useMemo(() => new Set(areaSends.map((item) => item.content_item_id)), [areaSends]);
  const offered = useMemo(
    () => (library.data ?? []).filter((item) => !exercises || item.kind === TIPO_CONTEUDO.VIDEO),
    [library.data, exercises],
  );

  const sendingItemId = send.isPending ? (send.variables?.contentItemId ?? null) : null;
  const sendContent = (content: SendableContent) =>
    send.mutate({ contentItemId: content.content_item_id, specialty, title: content.title });

  const opened = areaSends.filter((item) => item.opened_at).length;

  const title = exercises
    ? "Plano domiciliar"
    : own
      ? "Enviar orientação direcionada"
      : `Orientações enviadas por ${field}`;

  const subtitle = exercises
    ? areaSends.length === 0
      ? "Exercícios em vídeo liberados no app do paciente."
      : `${pluralize(areaSends.length, "vídeo liberado", "vídeos liberados")} · o paciente abriu ${opened}`
    : own
      ? "Selecione na biblioteca para enviar ao paciente. As marcadas para o diagnóstico dele vêm primeiro."
      : `O que ${field} enviou ao app do paciente, e se ele abriu.`;

  const emptyLibrary = (
    <EmptyState
      compact
      title={exercises ? `Nenhum vídeo de ${field} na biblioteca` : `Nenhuma orientação de ${field} na biblioteca`}
      description="Escreva em Conteúdo. Depois de aprovada e publicada, ela aparece aqui para enviar."
      action={
        <Button asChild variant="outline" size="sm">
          <Link to={`/clinico/${specialty}/conteudo`}>Abrir Conteúdo</Link>
        </Button>
      }
    />
  );

  const libraryBody = library.isLoading ? (
    <SkeletonRows count={3} />
  ) : library.isError ? (
    <ErrorState error={library.error} onRetry={() => void library.refetch()} compact />
  ) : offered.length === 0 ? (
    emptyLibrary
  ) : (
    <LibraryList
      items={offered}
      patientCids={patientCids}
      sentItemIds={sentItemIds}
      sendingItemId={sendingItemId}
      sendLabel={exercises ? "Liberar" : "Enviar"}
      limit={exercises || showAll ? null : SUGGESTIONS_SHOWN}
      onSend={sendContent}
    />
  );

  const sentBody = sends.isLoading ? (
    <SkeletonRows count={2} />
  ) : sends.isError ? (
    <ErrorState error={sends.error} onRetry={() => void sends.refetch()} compact />
  ) : areaSends.length === 0 ? (
    // The orientations card already lists the library above: an empty "sent"
    // block under it would only repeat that nothing went out yet.
    !exercises && own ? null : (
      <EmptyState
        compact
        title={exercises ? "Nenhum exercício liberado" : `Nada enviado por ${field}`}
        description={
          own
            ? `Use “Adicionar exercício” para liberar um vídeo no app de ${patientFirstName}.`
            : `Quando ${field} enviar algo a este paciente, aparece aqui.`
        }
      />
    )
  ) : (
    <ul className="divide-y" aria-label={exercises ? "Exercícios liberados" : "Orientações enviadas"}>
      {areaSends.map((item) => (
        <SentItem key={item.id} send={item} />
      ))}
    </ul>
  );

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex max-w-3xl flex-col gap-0.5">
            <h2 className="text-sm font-semibold">{title}</h2>
            <p className="text-muted-foreground text-xs">{subtitle}</p>
          </div>

          {exercises && own && (
            <Button type="button" variant="outline" size="sm" onClick={() => setPicking(true)}>
              <Video />
              Adicionar exercício
            </Button>
          )}
        </div>

        {!exercises && own && (
          <>
            {libraryBody}
            {!showAll && offered.length > SUGGESTIONS_SHOWN && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit"
                onClick={() => setShowAll(true)}
              >
                Ver todas ({offered.length})
              </Button>
            )}
            {areaSends.length > 0 && (
              <h3 className="text-muted-foreground pt-2 text-[11px] font-medium tracking-wider uppercase">
                Já enviadas
              </h3>
            )}
          </>
        )}

        {sentBody}
      </CardContent>

      {exercises && own && (
        <Dialog open={picking} onOpenChange={setPicking}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar exercício</DialogTitle>
              <DialogDescription>
                Os vídeos de {field} publicados na biblioteca. O liberado aparece no app de{" "}
                {patientFirstName}, que recebe um aviso.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">{libraryBody}</div>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}

export default DirectedContentCard;
